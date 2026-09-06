import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  emptyState,
  DAY,
  scheduleReview,
  dueConcepts,
  selectQuestions,
  recordAnswer,
  advanceSession,
  validateBackup,
  conceptStatus,
  uniqueEvidence,
} from '../lib/study-state.ts';
const lessons = JSON.parse(
  readFileSync(new URL('../lib/data/lessons.json', import.meta.url), 'utf8'),
);
const questions = JSON.parse(
  readFileSync(new URL('../lib/data/questions.json', import.meta.url), 'utf8'),
);
const edges = JSON.parse(
  readFileSync(new URL('../lib/data/edges.json', import.meta.url), 'utf8'),
);
const ids = lessons.map((l) => l.id),
  now = 1788660000000;
function session(qs = questions.slice(0, 4)) {
  return {
    ...emptyState(),
    active: {
      id: 'test-session',
      questionIds: qs.map((q) => q.id),
      index: 0,
      phase: 'answer',
      selected: null,
      guess: false,
      attemptId: null,
      elapsedMs: 2500,
      phaseMs: 2500,
      label: 'Test',
    },
  };
}
test('curriculum has complete connected teaching assets and traceable sources', () => {
  assert.equal(lessons.length, 10);
  assert.equal(questions.length, 30);
  assert.equal(new Set(ids).size, 10);
  assert.equal(new Set(questions.map((q) => q.id)).size, 30);
  for (const l of lessons) {
    assert.equal(l.sections.length, 3);
    assert.ok(l.sources.every((s) => s.url.startsWith('https://')));
    assert.match(l.review.note, /not independently expert-reviewed/);
    const group = questions.filter((q) => q.conceptId === l.id);
    assert.deepEqual(group.map((q) => q.variant).sort(), [1, 2, 3]);
  }
  for (const q of questions) {
    assert.ok(ids.includes(q.conceptId));
    assert.equal(q.options.length, 4);
    assert.equal(q.explanations.length, 4);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
    assert.equal(q.review.status, 'AI source-checked');
    assert.ok(q.decisiveDetail.length > 10);
  }
  for (const e of edges) {
    assert.ok(ids.includes(e.from) && ids.includes(e.to));
    assert.notEqual(e.from, e.to);
  }
  const connected = new Set([ids[0]]);
  for (let i = 0; i < ids.length; i++)
    for (const e of edges)
      if (connected.has(e.from) || connected.has(e.to)) {
        connected.add(e.from);
        connected.add(e.to);
      }
  assert.equal(connected.size, 10);
});
test('fresh state reports no invented progress', () => {
  const s = emptyState();
  assert.equal(uniqueEvidence(s).length, 0);
  assert.equal(conceptStatus(s, 'identity', now), 'Unseen');
  assert.deepEqual(dueConcepts(s, now), []);
  assert.deepEqual(validateBackup(s, ids, questions), s);
});
test('scheduler keeps mistakes and guesses due, spaces correct answers transparently', () => {
  const miss = scheduleReview(undefined, false, false, now);
  assert.equal(miss.dueAt, now);
  assert.equal(miss.needsReview, true);
  const guessed = scheduleReview(undefined, true, true, now);
  assert.equal(guessed.dueAt, now);
  let correct = scheduleReview(miss, true, false, now);
  assert.equal(correct.intervalDays, 3);
  assert.equal(correct.dueAt, now + 3 * DAY);
  for (let i = 0; i < 10; i++)
    correct = scheduleReview(correct, true, false, now);
  assert.equal(correct.intervalDays, 30);
  assert.equal(scheduleReview(correct, false, false, now).intervalDays, 1);
});
test('question selection diversifies concepts and prefers unseen variants', () => {
  const s = emptyState(),
    first = selectQuestions(questions, s, 'mixed', undefined, now);
  assert.equal(first.length, 4);
  assert.equal(new Set(first.map((q) => q.conceptId)).size, 4);
  const q = questions[0];
  s.attempts = [
    {
      id: 'a',
      questionId: q.id,
      conceptId: q.conceptId,
      correct: false,
      chosen: 0,
      guess: false,
      at: now,
      answerMs: 100,
      explanationMs: 0,
      repeated: false,
    },
  ];
  s.reviews[q.conceptId] = scheduleReview(undefined, false, false, now);
  const topic = selectQuestions(questions, s, 'topic', q.conceptId, now);
  assert.equal(topic.length, 3);
  assert.notEqual(topic[0].id, q.id);
  const review = selectQuestions(questions, s, 'review', undefined, now);
  assert.ok(review.every((x) => x.conceptId === q.conceptId));
  assert.notEqual(review[0].id, q.id);
});
test('answer feedback and mid-session reload preserve all evidence once', () => {
  const q = questions[0];
  let s = session([q]);
  s.active.selected = q.correctIndex;
  s = recordAnswer(s, q, now);
  assert.equal(s.attempts.length, 1);
  assert.equal(s.attempts[0].correct, true);
  assert.equal(s.attempts[0].guess, false);
  assert.equal(s.active.phase, 'explanation');
  assert.deepEqual(recordAnswer(s, q, now), s);
  s = validateBackup(JSON.parse(JSON.stringify(s)), ids, questions);
  s.active.phaseMs = 12000;
  s.active.elapsedMs += 12000;
  s = advanceSession(s, now + 12000);
  assert.equal(s.active, null);
  assert.equal(s.attempts[0].explanationMs, 12000);
  assert.equal(s.attempts[0].answerMs, 2500);
  assert.equal(s.sessions[0].elapsedMs, 14500);
  assert.equal(s.sessions[0].count, 1);
});
test('unfinished answer selection can resume without submitting it', () => {
  const q = questions[0],
    s = session([q]);
  s.active.selected = 2;
  s.active.guess = true;
  const restored = validateBackup(
    { state: JSON.parse(JSON.stringify(s)) },
    ids,
    questions,
  );
  assert.equal(restored.active.selected, 2);
  assert.equal(restored.active.phase, 'answer');
  assert.equal(restored.attempts.length, 0);
  assert.equal(restored.active.guess, true);
});
test('repeat practice does not inflate unique evidence', () => {
  const q = questions[0];
  let s = session([q]);
  s.active.selected = q.correctIndex;
  s = recordAnswer(s, q, now);
  s = advanceSession(s, now);
  s.active = { ...session([q]).active, id: 'second', selected: q.correctIndex };
  s = recordAnswer(s, q, now + DAY);
  assert.equal(s.attempts.length, 2);
  assert.equal(s.attempts[1].repeated, true);
  assert.equal(uniqueEvidence(s).length, 1);
});
test('backup round trip restores completed lessons, notes, reviews and active quiz', () => {
  let s = session();
  s.completed = ['identity'];
  s.visited = ['identity'];
  s.notes = [
    {
      id: 'note',
      conceptId: 'identity',
      text: 'A claim is not proof.',
      createdAt: now,
    },
  ];
  s.active.selected = questions[0].correctIndex;
  s = recordAnswer(s, questions[0], now);
  assert.deepEqual(
    validateBackup(
      { app: 'CISSP Buddy', state: JSON.parse(JSON.stringify(s)) },
      ids,
      questions,
    ),
    s,
  );
});
test('malformed, unknown and future backup data never validates', () => {
  const bad = [
    null,
    [],
    {},
    { ...emptyState(), version: 2 },
    { ...emptyState(), completed: ['unknown'] },
    { ...emptyState(), completed: ['identity', 'identity'] },
    { ...emptyState(), active: {} },
    {
      ...emptyState(),
      reviews: {
        unknown: {
          dueAt: now,
          intervalDays: 1,
          lastAt: now,
          needsReview: true,
        },
      },
    },
    {
      ...emptyState(),
      notes: [
        {
          id: 'n',
          conceptId: 'identity',
          text: 'x'.repeat(2001),
          createdAt: now,
        },
      ],
    },
  ];
  for (const value of bad)
    assert.throws(() => validateBackup(value, ids, questions));
  const forged = session([questions[0]]);
  forged.active.selected = questions[0].correctIndex;
  const answered = recordAnswer(forged, questions[0], now);
  answered.attempts[0].correct = false;
  assert.throws(() => validateBackup(answered, ids, questions));
});
test('due queue sorts overdue concepts first and sparse status stays cautious', () => {
  const s = emptyState();
  s.visited = ['identity'];
  assert.equal(conceptStatus(s, 'identity', now), 'Learning');
  s.reviews.identity = scheduleReview(undefined, false, false, now - 2 * DAY);
  s.reviews.authentication = scheduleReview(undefined, false, false, now - DAY);
  assert.deepEqual(dueConcepts(s, now), ['identity', 'authentication']);
  assert.equal(conceptStatus(s, 'identity', now), 'Needs review');
});
