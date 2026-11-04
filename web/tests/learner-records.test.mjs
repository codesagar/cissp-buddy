import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  splitCourseState,
  assembleCourseState,
  splitPilotState,
  assemblePilotState,
  assertCourseAnswersPreserved,
  assertPilotAnswersPreserved,
} from '../lib/learner/records.ts';
import {
  emptyLearnerState,
  newPosition,
  recordCourseAnswer,
} from '../lib/course/learner-state.ts';
import {
  recordAnswer,
  advanceSession,
  validateBackup,
} from '../lib/study-state.ts';

const read = (file) =>
  JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const lessons = read('../lib/data/lessons.json');
const questions = read('../lib/data/questions.json');
const validatePilot = (value) =>
  validateBackup(
    value,
    lessons.map((lesson) => lesson.id),
    questions,
  );
const now = 1793799741000;
const check = {
  id: 'record-check',
  prompt: 'Which actor must enforce this access decision?',
  conceptIds: ['authorization'],
  hint: 'Separate deciding from enforcement.',
  options: [
    {
      id: 'api',
      label: 'The API enforcement point',
      correct: true,
      feedback: 'The API controls this request.',
      repairStateId: 'gate',
    },
    {
      id: 'person',
      label: 'The authenticated person',
      correct: false,
      feedback: 'Authentication alone does not enforce this policy.',
      repairStateId: 'gate',
    },
  ],
};
function course() {
  const state = emptyLearnerState();
  state.lastUnitId = 'unit-1';
  state.units['unit-1'] = {
    ...newPosition(now),
    note: 'Keep the enforcement boundary explicit.',
    exploration: { workedOutcomeVisible: true, assignment: 'unknown' },
    checks: { [check.id]: { selected: 'person', guess: true, hintUsed: true } },
  };
  const answered = recordCourseAnswer(
    state,
    'unit-1',
    check,
    'prediction',
    'historical-release',
    now,
    'answer-1',
  );
  answered.reviews['historical-unit'] = {
    dueAt: now,
    lastAt: now,
    intervalDays: 1,
    needsReview: true,
  };
  return answered;
}
function pilot() {
  return read('./fixtures/pilot-backup-v1.json');
}

test('course record round trip retains original answer evidence, positions and review-only history', () => {
  const state = course();
  const records = splitCourseState(state);
  assert.equal('attempts' in records.metadata, false);
  assert.equal(
    records.units.find((row) => row.id === 'historical-unit').position,
    null,
  );
  assert.deepEqual(assembleCourseState(records), state);
  records.units[0].position.note = 'Modified copy';
  assert.equal(
    state.units['unit-1'].note,
    'Keep the enforcement boundary explicit.',
  );
});

test('partial or duplicate record hydration is rejected instead of inventing progress', () => {
  const records = splitCourseState(course());
  records.attempts = [];
  assert.throws(() => assembleCourseState(records), /incomplete or damaged/);
  const duplicate = splitCourseState(course());
  duplicate.units.push(structuredClone(duplicate.units[0]));
  assert.throws(() => assembleCourseState(duplicate), /duplicate identities/);
});

test('history larger than one document remains separate from bounded course metadata', () => {
  const state = course();
  const template = state.attempts[0];
  state.attempts = Array.from({ length: 800 }, (_, i) => ({
    ...structuredClone(template),
    id: `history-${i}`,
    snapshot: {
      ...structuredClone(template.snapshot),
      prompt: 'P'.repeat(2000),
    },
  }));
  state.units['unit-1'].checks[check.id].submittedAttemptId = 'history-799';
  const records = splitCourseState(state);
  assert.ok(Buffer.byteLength(JSON.stringify(records.attempts)) > 1_048_576);
  assert.ok(Buffer.byteLength(JSON.stringify(records.metadata)) < 1024);
  assert.ok(
    records.attempts.every(
      (attempt) => Buffer.byteLength(JSON.stringify(attempt)) < 5000,
    ),
  );
  assert.deepEqual(assembleCourseState(records), state);
});

test('normal course saves permit new answers but refuse history removal or rewritten snapshots', () => {
  const before = course();
  const after = structuredClone(before);
  after.attempts.push({
    ...structuredClone(after.attempts[0]),
    id: 'answer-2',
  });
  assert.doesNotThrow(() => assertCourseAnswersPreserved(before, after));
  for (const mutate of [
    (s) => {
      s.attempts = [];
    },
    (s) => {
      s.attempts[0].snapshot.prompt = 'Rewritten question';
    },
    (s) => {
      s.attempts[0].hintUsed = false;
    },
  ]) {
    const invalid = structuredClone(before);
    mutate(invalid);
    assert.throws(
      () => assertCourseAnswersPreserved(before, invalid),
      /cannot remove or rewrite/,
    );
  }
});

test('legacy pilot record round trip retains unfinished selection, timing and all existing formats', () => {
  const state = validatePilot(pilot());
  state.active.selected = 1;
  state.notes.push({
    id: 'note-1',
    conceptId: 'identity',
    text: 'A synthetic note',
    createdAt: now,
  });
  const records = splitPilotState(state);
  assert.equal('attempts' in records.metadata, false);
  assert.deepEqual(assemblePilotState(records, validatePilot), state);
});

test('pilot explanation completion can change timing, but cannot rewrite submitted answers', () => {
  let state = validatePilot(pilot());
  const question = questions.find((q) => q.id === state.active.questionIds[0]);
  state.active.selected = 0;
  state = recordAnswer(state, question, now);
  const before = structuredClone(state);
  state.active.phaseMs = 2500;
  state.active.elapsedMs += 2500;
  const after = advanceSession(state, now + 2500);
  assert.equal(after.attempts[0].explanationMs, 2500);
  assert.doesNotThrow(() => assertPilotAnswersPreserved(before, after));
  const invalid = structuredClone(after);
  invalid.attempts[0].chosen = 2;
  assert.throws(
    () => assertPilotAnswersPreserved(before, invalid),
    /cannot remove or rewrite/,
  );
  const lost = structuredClone(after);
  lost.attempts = [];
  assert.throws(
    () => assertPilotAnswersPreserved(before, lost),
    /cannot remove or rewrite/,
  );
});
