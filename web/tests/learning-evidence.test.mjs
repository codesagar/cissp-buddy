import '../scripts/qa-tsx-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  emptyLearnerState,
  newPosition,
  recordCourseAnswer,
  currentCourseEvidence,
} from '../lib/course/learner-state.ts';
import { learningEvidence } from '../lib/course/learning-evidence.ts';
const { CourseLearningEvidence } =
  await import('../components/course-learning-evidence.tsx');

const now = Date.UTC(2026, 10, 4, 12);
const kinds = ['prediction', 'transfer', 'retry'];
const units = [1, 2, 3].map((number) => ({
  id: `unit-${number}`,
  title: `Unit ${number}`,
  domainId: 1,
  conceptIds: ['alpha', 'beta', 'unscoped'],
  teachingReady: true,
  checks: kinds.map((kind) => ({
    id: `${kind}-${number}`,
    conceptIds: kind === 'transfer' ? ['beta'] : ['alpha'],
  })),
}));
const manifest = {
  releaseId: 'release-current',
  sourceHash: '',
  publishedAt: '',
  domains: [],
  counts: {
    units: 4,
    concepts: 4,
    conceptOccurrences: 10,
    teachingModels: 3,
    assessments: 9,
  },
  units: [
    ...units,
    {
      id: 'reading-only',
      title: 'Reading only',
      conceptIds: ['reading-only'],
      checks: [],
      teachingReady: false,
    },
  ],
};
function answer(
  state = emptyLearnerState(),
  {
    unit = 0,
    check = 0,
    correct = true,
    hintUsed = false,
    guess = false,
    outcomeViewed = false,
    at = now,
    id = 'attempt-1',
    releaseId = manifest.releaseId,
  } = {},
) {
  const summary = units[unit];
  const scoped = summary.checks[check];
  const snapshot = {
    ...scoped,
    prompt: `What controls ${scoped.id}?`,
    hint: 'Inspect the boundary.',
    options: [
      {
        id: 'yes',
        label: 'Enforce the boundary',
        correct: true,
        feedback: 'Supported.',
        repairStateId: 'boundary',
      },
      {
        id: 'no',
        label: 'Ignore the boundary',
        correct: false,
        feedback: 'Revisit scope.',
        repairStateId: 'scope',
      },
    ],
  };
  const next = structuredClone(state);
  next.units[summary.id] = {
    ...(next.units[summary.id] || newPosition(at)),
    checks: {
      ...next.units[summary.id]?.checks,
      [scoped.id]: {
        selected: correct ? 'yes' : 'no',
        hintUsed,
        guess,
        outcomeViewed,
      },
    },
  };
  return recordCourseAnswer(
    next,
    summary.id,
    snapshot,
    kinds[check],
    releaseId,
    at,
    id,
  );
}

test('visits do not create evidence, scope stays exact, and empty-state actions are bounded', () => {
  const state = emptyLearnerState();
  state.units['unit-1'] = newPosition(now);
  const summary = learningEvidence(state, manifest, now);
  assert.equal(summary.totalChecks, 9);
  assert.equal(summary.unanswered, 9);
  assert.equal(summary.correctUnassisted, 0);
  assert.equal(summary.conceptsWithoutUnitCheck, 2);
  assert.equal(summary.explainedConcepts, 4);
  assert.deepEqual(
    summary.actions.map((action) => action.unitId),
    ['unit-1', 'unit-2', 'unit-3'],
  );
  assert.match(summary.actions[0].reason, /visit is separate/);
  assert.equal(summary.actions[0].href, '#/unit/unit-1/predict');
});

test('a later mistake replaces current success while preserving historical evidence and repeats', () => {
  const older = answer();
  const state = answer(older, {
    correct: false,
    at: now + 100,
    id: 'later-wrong',
  });
  const before = JSON.stringify(state);
  const summary = learningEvidence(state, manifest, now + 101);
  assert.equal(summary.correctUnassisted, 0);
  assert.equal(summary.needsReview, 1);
  assert.equal(summary.unanswered, 8);
  assert.equal(summary.repeatedResponses, 1);
  assert.equal(summary.checks[0].latest.id, 'later-wrong');
  assert.match(
    summary.actions[0].reason,
    /latest prediction response was incorrect/,
  );
  assert.equal(summary.actions[0].href, '#/unit/unit-1/review');
  assert.equal(
    currentCourseEvidence(state, manifest).independent,
    1,
    'historical helper keeps its original meaning',
  );
  assert.equal(
    JSON.stringify(state),
    before,
    'derivation never mutates saved attempts or scheduling',
  );
});

test('a later hinted, uncertain, or revealed response is not an unassisted current success', () => {
  for (const flag of ['hintUsed', 'guess', 'outcomeViewed']) {
    const state = answer(answer(), { [flag]: true, id: flag, at: now + 1 });
    const summary = learningEvidence(state, manifest, now + 2);
    assert.equal(summary.correctUnassisted, 0, flag);
    assert.equal(summary.needsReview, 1, flag);
    assert.equal(summary.checks[0].latest[flag], true);
    assert.match(summary.actions[0].reason, /hint|uncertain|revealed/);
  }
});

test('latest timestamp wins independent of hydration order; current reference resolves exact-time ties', () => {
  let state = answer(answer(), { correct: false, id: 'a-wrong', at: now });
  state.attempts.reverse();
  assert.equal(
    learningEvidence(state, manifest, now).checks[0].latest.id,
    'a-wrong',
  );
  delete state.units['unit-1'].checks['prediction-1'].submittedAttemptId;
  const first = learningEvidence(state, manifest, now).checks[0].latest.id;
  state.attempts.reverse();
  assert.equal(
    learningEvidence(state, manifest, now).checks[0].latest.id,
    first,
    'unreferenced ties use stable IDs',
  );
  state.units['unit-1'].checks['prediction-1'].submittedAttemptId = 'a-wrong';
  state = answer(state, { correct: true, id: 'newest', at: now + 1 });
  state.units['unit-1'].checks['prediction-1'].submittedAttemptId = 'a-wrong';
  assert.equal(
    learningEvidence(state, manifest, now).checks[0].latest.id,
    'newest',
    'an older reference does not override a newer timestamp',
  );
});

test('stable older-release identities count; removed, foreign-owner, wrong-phase and mismatched scopes do not', () => {
  const state = answer(undefined, { releaseId: 'release-older' });
  const original = state.attempts[0];
  const excluded = [
    { ...original, id: 'removed', questionId: 'retired-question', at: now + 5 },
    {
      ...original,
      id: 'connection',
      unitId: 'cross-case',
      questionId: 'cross-check',
      at: now + 5,
    },
    { ...original, id: 'foreign-unit', unitId: 'unit-2', at: now + 5 },
    { ...original, id: 'wrong-phase', kind: 'retry', at: now + 5 },
    { ...original, id: 'wrong-scope', conceptIds: ['unscoped'], at: now + 5 },
    {
      ...original,
      id: 'wrong-snapshot',
      snapshot: { ...original.snapshot, conceptIds: ['unscoped'] },
      at: now + 5,
    },
  ];
  state.attempts.push(...excluded);
  const summary = learningEvidence(state, manifest, now + 6);
  assert.equal(summary.correctUnassisted, 1);
  assert.equal(summary.repeatedResponses, 0);
  assert.equal(summary.checks[0].latest.releaseId, 'release-older');
  assert.equal(state.attempts.length, 7, 'other history remains untouched');
});

test('latest correct answers do not erase a separate changed-retry need or a due schedule', () => {
  let state = answer(undefined, { correct: false });
  state = answer(state, { correct: true, id: 'later-correct', at: now + 100 });
  const summary = learningEvidence(state, manifest, now + 101);
  assert.equal(summary.correctUnassisted, 1);
  assert.equal(summary.needsReview, 0);
  assert.equal(summary.unitsDue, 1);
  assert.match(
    summary.actions[0].reason,
    /earlier response still needs a changed retry/,
  );
  state.reviews['unit-1'] = {
    dueAt: now - 1,
    lastAt: now - 100,
    intervalDays: 3,
    needsReview: false,
  };
  assert.match(
    learningEvidence(state, manifest, now).actions[0].reason,
    /spaced review is due/,
  );
});

for (const scenario of [
  { name: 'incorrect prediction', check: 0, correct: false },
  { name: 'assisted transfer', check: 1, correct: true, hintUsed: true },
]) {
  test(`a successful changed retry repairs an ${scenario.name} until its scheduled review`, () => {
    let state = answer(undefined, { ...scenario, id: 'original-problem' });
    state = answer(state, {
      check: 2,
      correct: true,
      id: 'successful-retry',
      at: now + 100,
    });
    const review = state.reviews['unit-1'];
    assert.equal(
      review.needsReview,
      false,
      'actual answer recording clears the repair need',
    );
    assert.equal(review.intervalDays, 3);
    const before = learningEvidence(state, manifest, review.dueAt - 1);
    assert.equal(before.unitsDue, 0);
    assert.equal(
      before.needsReview,
      1,
      'the original response stays in named-check evidence',
    );
    assert.equal(before.correctUnassisted, 1);
    const next = before.actions.find((action) => action.unitId === 'unit-1');
    assert.notEqual(
      next.label,
      'Review this decision',
      'do not ask for an already completed repair',
    );
    assert.equal(
      next.href,
      scenario.check === 0 ? '#/unit/unit-1/transfer' : '#/unit/unit-1/predict',
      'other unanswered material is still offered',
    );
    const due = learningEvidence(state, manifest, review.dueAt);
    assert.equal(due.unitsDue, 1);
    const action = due.actions.find((action) => action.unitId === 'unit-1');
    assert.match(action.reason, /spaced review is due/);
    assert.doesNotMatch(action.reason, /was incorrect|used a hint|still needs/);
    assert.equal(action.kind, 'retry');
    assert.equal(action.checkId, 'retry-1');
    assert.equal(
      action.latest,
      null,
      'spaced due is not described using the old problem response',
    );
    assert.equal(state.attempts.length, 2);
  });
}

test('repair actions precede unanswered material and unanswered actions target the remaining phase', () => {
  let state = answer(undefined, { unit: 2, correct: false });
  state = answer(state, { unit: 0, id: 'unit1-predict', at: now + 1 });
  state.reviews = { 'unit-3': state.reviews['unit-3'] };
  const summary = learningEvidence(state, manifest, now + 2);
  assert.deepEqual(
    summary.actions.map((action) => action.unitId),
    ['unit-3', 'unit-1', 'unit-2'],
  );
  assert.equal(summary.actions[1].href, '#/unit/unit-1/transfer');
  assert.equal(
    new Set(summary.actions.map((action) => action.unitId)).size,
    summary.actions.length,
  );
});

test('compact panel avoids duplicating action rows; full panel explains scope and latest assistance', () => {
  const state = answer(undefined, {
    hintUsed: true,
    guess: true,
    outcomeViewed: true,
  });
  const render = (compact = false) =>
    renderToStaticMarkup(
      React.createElement(CourseLearningEvidence, {
        state,
        manifest,
        now,
        compact,
      }),
    );
  const full = render();
  assert.match(full, /Latest response:/);
  assert.match(full, /Hint used/);
  assert.match(full, /Marked uncertain/);
  assert.match(full, /Outcome or explanation revealed/);
  assert.match(full, /Incorrect, assisted or uncertain/);
  assert.match(full, /<p class="learning-evidence-check">Prediction<\/p>/);
  assert.match(
    full,
    /<details class="learning-evidence-check"><summary>Which check\?<\/summary><code>prediction-1<\/code><\/details>/,
  );
  assert.doesNotMatch(full, /Named check:/);
  assert.match(
    full,
    /2 of 4 explained concepts have no directly scoped unit check/,
  );
  assert.match(full, /Connection cases may assess some separately/);
  assert.match(full, /do not establish mastery or exam readiness/);
  const compact = render(true);
  assert.match(compact, /Inspect evidence &amp; review/);
  assert.doesNotMatch(compact, /learning-evidence-actions|Which check/);
  assert.match(compact, /connection cases are separate/);
});

test('all-current and no-check states do not invent a further assessment or crash on a valid large timestamp', () => {
  let state = emptyLearnerState();
  for (let unit = 0; unit < 3; unit++)
    for (let check = 0; check < 3; check++)
      state = answer(state, { unit, check, id: `${unit}-${check}` });
  state.reviews = {};
  assert.equal(learningEvidence(state, manifest, now).actions.length, 0);
  const noChecks = { ...manifest, units: [manifest.units[3]] };
  const noCheckHtml = renderToStaticMarkup(
    React.createElement(CourseLearningEvidence, {
      state,
      manifest: noChecks,
      now,
    }),
  );
  assert.match(noCheckHtml, /No directly scoped unit checks are available/);
  state = answer(undefined, { correct: false, at: Number.MAX_SAFE_INTEGER });
  const html = renderToStaticMarkup(
    React.createElement(CourseLearningEvidence, { state, manifest, now }),
  );
  assert.match(html, /Date unavailable/);
});
