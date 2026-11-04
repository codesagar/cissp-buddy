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
  currentCourseEvidence,
  recommendCourseUnit,
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
    'unit-1',
    check,
    'prediction',
    'old',
    now,
    'a',
  );
  const historical = structuredClone(s);
  historical.units['historical-unit'] = historical.units['unit-1'];
  delete historical.units['unit-1'];
  historical.attempts[0].unitId = 'historical-unit';
  historical.lastUnitId = 'historical-unit';
  assert.deepEqual(validateLearnerState(historical), historical);
  assert.equal(historical.attempts[0].releaseId, 'old');
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
test('legacy-format synthetic pilot backup retains active quiz, position, timing and identities', () => {
  const backup = JSON.parse(
    readFileSync(
      new URL('./fixtures/pilot-backup-v1.json', import.meta.url),
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

test('recommendations use curriculum order and declared prerequisite exposure without treating visits as answers', () => {
  const manifest = {
    units: [
      {
        id: 'foundation',
        title: 'Foundation',
        conceptIds: ['boundary'],
        prerequisites: [],
        checks: [{ id: 'foundation-check', conceptIds: ['boundary'] }],
      },
      {
        id: 'next',
        title: 'Next decision',
        conceptIds: ['decision', 'unassessed'],
        prerequisites: ['boundary'],
        checks: [{ id: 'next-check', conceptIds: ['decision'] }],
      },
    ],
  };
  const state = emptyLearnerState();
  assert.equal(recommendCourseUnit(state, manifest).unit.id, 'foundation');
  state.units.foundation = newPosition(now);
  assert.equal(
    recommendCourseUnit(state, manifest).unit.id,
    'foundation',
    'a visit leaves its check unanswered',
  );
  state.attempts.push({
    questionId: 'foundation-check',
    correct: true,
    conceptIds: ['boundary'],
  });
  assert.equal(recommendCourseUnit(state, manifest).unit.id, 'next');
  assert.match(
    recommendCourseUnit(state, manifest).reason,
    /exposure, not mastery/,
  );
  delete state.units.foundation;
  assert.equal(
    recommendCourseUnit(state, manifest).unit.id,
    'foundation',
    'unvisited prerequisite comes before next unit',
  );
  state.attempts.push({
    questionId: 'next-check',
    correct: true,
    conceptIds: ['decision'],
  });
  assert.equal(recommendCourseUnit(state, manifest), null);
});

test('evidence separates assistance, repeats, unanswered checks and unassessed explanation', () => {
  const manifest = {
    units: [
      {
        id: 'unit-1',
        conceptIds: ['authorization', 'context'],
        checks: [
          { id: check.id, conceptIds: ['authorization'] },
          { id: 'unanswered-check', conceptIds: ['authorization'] },
        ],
      },
    ],
  };
  const state = recordCourseAnswer(
    draft('deny', { hintUsed: true }),
    'unit-1',
    check,
    'prediction',
    'release-a',
    now,
    'assisted',
  );
  state.attempts.push({
    ...state.attempts[0],
    id: 'independent',
    hintUsed: false,
  });
  state.attempts.push({
    ...state.attempts[0],
    id: 'historical',
    questionId: 'retired-check',
  });
  assert.deepEqual(currentCourseEvidence(state, manifest), {
    unanswered: 1,
    independent: 1,
    assisted: 1,
    repeated: 1,
    noDirectCheck: 1,
  });
  assert.equal(state.attempts.length, 3, 'historical evidence remains intact');
});

test('blocked reads make no writes and persistent write failures preserve originals when possible', () => {
  let writes = 0;
  const blocked = {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      writes++;
    },
    removeItem() {},
  };
  assert.throws(
    () => writeProgressBackup(blocked, { course: emptyLearnerState() }),
    /blocked/,
  );
  assert.equal(writes, 0);
  const values = new Map([
    ['cissp-buddy:course:v1', 'original-course'],
    ['cissp-buddy:v1', 'original-pilot'],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (key === 'cissp-buddy:v1') throw Error('persistent quota');
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key),
  };
  assert.throws(
    () =>
      writeProgressBackup(storage, { course: emptyLearnerState(), pilot: {} }),
    /persistent quota/,
  );
  assert.equal(values.get('cissp-buddy:course:v1'), 'original-course');
  assert.equal(values.get('cissp-buddy:v1'), 'original-pilot');
});

test('rollback failure reports partial replacement honestly without dropping active state', () => {
  const state = emptyLearnerState();
  const original = structuredClone(state);
  const values = new Map([
    ['cissp-buddy:course:v1', 'original-course'],
    ['cissp-buddy:v1', 'original-pilot'],
  ]);
  let writes = 0;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      writes++;
      if (writes > 1) throw Error('all writes blocked');
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key),
  };
  assert.throws(
    () => writeProgressBackup(storage, { course: state, pilot: {} }),
    /Some stored records may have changed/,
  );
  assert.equal(values.get('cissp-buddy:v1'), 'original-pilot');
  assert.deepEqual(state, original);
});

test('imported evidence must retain original scope and match its saved check', () => {
  const state = recordCourseAnswer(
    draft('deny'),
    'unit-1',
    check,
    'prediction',
    'r',
    now,
    'answer',
  );
  for (const change of [
    (copy) => {
      copy.attempts[0].conceptIds = ['invented-coverage'];
    },
    (copy) => {
      copy.attempts[0].snapshot.options[1].id =
        copy.attempts[0].snapshot.options[0].id;
    },
    (copy) => {
      copy.attempts[0].unitId = 'another-unit';
    },
    (copy) => {
      copy.units['unit-1'].checks[check.id].selected = 'allow';
    },
  ]) {
    const invalid = structuredClone(state);
    change(invalid);
    assert.throws(() => validateLearnerState(invalid));
  }
  assert.deepEqual(validateLearnerState(state), state);
});

test('mixed prerequisite references resolve exact units separately from concepts', () => {
  const manifest = {
    units: [
      {
        id: 'foundation-unit',
        title: 'Foundation',
        conceptIds: ['shared-concept'],
        prerequisites: [],
        checks: [{ id: 'one', conceptIds: ['shared-concept'] }],
      },
      {
        id: 'other-unit',
        title: 'Other',
        conceptIds: ['shared-concept'],
        prerequisites: [],
        checks: [{ id: 'two', conceptIds: ['shared-concept'] }],
      },
      {
        id: 'next-unit',
        title: 'Next',
        conceptIds: ['decision'],
        prerequisites: ['foundation-unit', 'shared-concept'],
        checks: [{ id: 'three', conceptIds: ['decision'] }],
      },
    ],
  };
  const state = emptyLearnerState();
  state.attempts = [{ questionId: 'one' }, { questionId: 'two' }];
  state.units['other-unit'] = newPosition(now);
  assert.equal(
    recommendCourseUnit(state, manifest).unit.id,
    'foundation-unit',
    'a concept visit in another unit does not count as the named prerequisite unit visit',
  );
  state.units['foundation-unit'] = newPosition(now);
  assert.equal(recommendCourseUnit(state, manifest).unit.id, 'next-unit');
  assert.match(
    recommendCourseUnit(state, manifest).reason,
    /exposure, not mastery/,
  );
});
