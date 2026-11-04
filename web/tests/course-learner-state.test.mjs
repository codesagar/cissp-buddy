import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  markViewedOutcomes,
  repairPosition,
  writeProgressBackup,
  emptyLearnerState,
  newPosition,
  recordCourseAnswer,
  validateLearnerState,
  dueUnits,
  courseEvidence,
} from '../lib/course/learner-state.ts';
import { validateBackup } from '../lib/study-state.ts';
const now = 1789791000000;
const check = {
  id: 'test-check-v1',
  prompt: 'Which boundary controls this request?',
  conceptIds: ['authorization'],
  hint: 'Identify the enforcing actor.',
  options: [
    {
      id: 'deny',
      label: 'Enforce the denial',
      correct: true,
      feedback: 'The gate must enforce current policy.',
      repairStateId: 'enforce',
    },
    {
      id: 'pass',
      label: 'Let authentication decide',
      correct: false,
      feedback: 'Authentication does not grant this action.',
      repairStateId: 'policy',
    },
  ],
};
function draft(choice = 'pass', extra = {}) {
  const s = emptyLearnerState();
  s.units['unit-1'] = {
    ...newPosition(now),
    checks: {
      [check.id]: { selected: choice, guess: false, hintUsed: false, ...extra },
    },
  };
  return s;
}
test('wrong answer persists exact immutable evidence and requires changed retry', () => {
  let s = recordCourseAnswer(
    draft(),
    'unit-1',
    check,
    'prediction',
    'release-a',
    now,
    'a1',
  );
  assert.equal(s.attempts.length, 1);
  assert.equal(s.reviews['unit-1'].needsReview, true);
  assert.deepEqual(dueUnits(s, now), ['unit-1']);
  assert.deepEqual(validateLearnerState(JSON.parse(JSON.stringify(s))), s);
  assert.equal(
    recordCourseAnswer(
      s,
      'unit-1',
      check,
      'prediction',
      'release-a',
      now,
      'duplicate',
    ),
    s,
  );
  const changed = { ...check, id: 'transfer-v1' };
  s.units['unit-1'].checks[changed.id] = {
    selected: 'deny',
    guess: false,
    hintUsed: false,
  };
  s = recordCourseAnswer(
    s,
    'unit-1',
    changed,
    'transfer',
    'release-a',
    now + 1,
    'a2',
  );
  assert.equal(
    s.reviews['unit-1'].needsReview,
    true,
    'transfer after a miss does not erase the repair need',
  );
  const retry = { ...check, id: 'changed-retry-v1' };
  s.units['unit-1'].checks[retry.id] = {
    selected: 'deny',
    guess: false,
    hintUsed: false,
  };
  s = recordCourseAnswer(
    s,
    'unit-1',
    retry,
    'retry',
    'release-a',
    now + 2,
    'a3',
  );
  assert.equal(s.reviews['unit-1'].needsReview, false);
  assert.equal(s.reviews['unit-1'].intervalDays, 3);
  assert.equal(s.attempts[0].snapshot.options[0].label, 'Enforce the denial');
  assert.deepEqual(courseEvidence(s), {
    visited: 1,
    attempted: 3,
    transfers: 1,
    supportedConcepts: 1,
  });
});
test('guesses and hinted correct retries stay due; selection alone records no answer', () => {
  for (const flag of ['guess', 'hintUsed', 'outcomeViewed']) {
    const s = recordCourseAnswer(
      draft('deny', { [flag]: true }),
      'unit-1',
      check,
      'retry',
      'r',
      now,
      flag,
    );
    assert.equal(s.reviews['unit-1'].needsReview, true);
  }
  const s = draft(null);
  assert.equal(
    recordCourseAnswer(s, 'unit-1', check, 'prediction', 'r', now, 'none'),
    s,
  );
});
test('damaged state rejects without changing supplied object; historical IDs survive', () => {
  const s = recordCourseAnswer(
    draft(),
    'historical-unit',
    check,
    'prediction',
    'old',
    now,
    'a',
  );
  assert.deepEqual(validateLearnerState(s), s);
  for (const mutate of [
    (x) => (x.version = 99),
    (x) => (x.preferences.theme = 'unknown'),
    (x) => (x.units['unit-1'].step = -1),
    (x) =>
      (x.reviews.bad = {
        dueAt: NaN,
        lastAt: 0,
        intervalDays: 3,
        needsReview: false,
      }),
  ]) {
    const bad = structuredClone(s);
    mutate(bad);
    assert.throws(() => validateLearnerState(bad));
  }
  const valid = recordCourseAnswer(
    draft(),
    'unit-1',
    check,
    'prediction',
    'r',
    now,
    'a1',
  );
  const forged = structuredClone(valid);
  forged.attempts[0].correct = true;
  assert.throws(() => validateLearnerState(forged));
  const dangling = structuredClone(valid);
  dangling.units['unit-1'].checks[check.id].submittedAttemptId = 'missing';
  assert.throws(() => validateLearnerState(dangling));
});
test('actual existing pilot backup retains active quiz, position, timing and identities', () => {
  const backup = JSON.parse(
    readFileSync(
      new URL(
        '../../planning/visual-learning-production/qa/existing-pilot-backup.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const lessons = JSON.parse(
    readFileSync(new URL('../lib/data/lessons.json', import.meta.url), 'utf8'),
  );
  const questions = JSON.parse(
    readFileSync(
      new URL('../lib/data/questions.json', import.meta.url),
      'utf8',
    ),
  );
  const restored = validateBackup(
    backup,
    lessons.map((l) => l.id),
    questions,
  );
  assert.deepEqual(restored, backup);
  assert.equal(restored.active.index, 0);
  assert.equal(restored.active.elapsedMs, 438005);
  assert.equal(restored.active.questionIds[0], 'access-lifecycle-1');
});

test('combined restore rolls back a first successful write when the second fails', () => {
  const values = new Map([
    ['cissp-buddy:course:v1', 'original-course'],
    ['cissp-buddy:v1', 'original-pilot'],
  ]);
  const storage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => {
      if (v === '{"fail":true}') throw Error('quota');
      values.set(k, v);
    },
    removeItem: (k) => values.delete(k),
  };
  assert.throws(() =>
    writeProgressBackup(storage, {
      course: emptyLearnerState(),
      pilot: { fail: true },
    }),
  );
  assert.equal(values.get('cissp-buddy:course:v1'), 'original-course');
  assert.equal(values.get('cissp-buddy:v1'), 'original-pilot');
  writeProgressBackup(storage, {
    course: emptyLearnerState(),
    pilot: { version: 1 },
  });
  assert.equal(JSON.parse(values.get('cissp-buddy:course:v1')).version, 1);
});

test('repair links resolve the exact base or variant state rather than falling back to step zero', () => {
  const model = {
    states: [{ id: 'base-fact' }, { id: 'base-outcome' }],
    variants: [
      {
        id: 'different-system',
        states: [{ id: 'variant-fact' }, { id: 'variant-consequence' }],
      },
    ],
  };
  assert.deepEqual(repairPosition(model, 'base-outcome'), {
    step: 1,
    variant: 'base',
  });
  assert.deepEqual(repairPosition(model, 'variant-consequence'), {
    step: 1,
    variant: 'different-system',
  });
});

test('outcome exposure is check-specific, sticky through restore, and never rewrites submitted evidence', () => {
  const transfer = {
    ...check,
    id: 'changed-case',
    options: check.options.map((o) => ({
      ...o,
      repairStateId: 'changed-outcome',
    })),
  };
  const retry = { ...check, id: 'third-case' };
  const model = {
    prediction: check,
    transfer,
    retry,
    variants: [{ id: 'changed', states: [{ id: 'changed-outcome' }] }],
  };
  let pos = markViewedOutcomes(newPosition(now), model, 'base');
  assert.equal(pos.checks[check.id].outcomeViewed, true);
  assert.equal(pos.checks[transfer.id], undefined);
  let s = emptyLearnerState();
  s.units['unit-1'] = pos;
  s.units['unit-1'].checks[check.id].selected = 'deny';
  s = recordCourseAnswer(
    s,
    'unit-1',
    check,
    'prediction',
    'r',
    now,
    'assisted',
  );
  assert.equal(s.attempts[0].outcomeViewed, true);
  assert.equal(s.attempts[0].hintUsed, false);
  assert.equal(s.reviews['unit-1'].needsReview, true);
  assert.deepEqual(validateLearnerState(JSON.parse(JSON.stringify(s))), s);
  const original = structuredClone(s.attempts[0]);
  s.units['unit-1'] = markViewedOutcomes(s.units['unit-1'], model, 'changed');
  assert.equal(s.units['unit-1'].checks[transfer.id].outcomeViewed, true);
  assert.equal(s.units['unit-1'].checks[retry.id], undefined);
  assert.deepEqual(s.attempts[0], original);
  const committed = recordCourseAnswer(
    draft('deny'),
    'unit-1',
    check,
    'prediction',
    'r',
    now,
    'unassisted',
  );
  const unchanged = markViewedOutcomes(
    committed.units['unit-1'],
    model,
    'base',
  );
  assert.equal(unchanged.checks[check.id].outcomeViewed, undefined);
  assert.equal(committed.attempts[0].outcomeViewed, false);
  const bad = structuredClone(s);
  bad.attempts[0].outcomeViewed = 'yes';
  assert.throws(() => validateLearnerState(bad));
});
