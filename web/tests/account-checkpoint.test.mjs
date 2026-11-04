import '../scripts/qa-tsx-loader.mjs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
registerHooks({
  load(url, context, next) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : next(url, context);
  },
});
const { checkpointSignature } = await import('../lib/learner/hooks.ts');
const active = {
  id: 'session-one',
  questionIds: ['one'],
  index: 0,
  phase: 'answer',
  selected: null,
  guess: false,
  elapsedMs: 0,
  phaseMs: 0,
};
const pilot = { version: 1, active, attempts: [], notes: [] };
test('one-minute pilot timer ticks do not each become a meaningful cloud mutation', () => {
  const expected = checkpointSignature('pilot', pilot);
  for (let second = 1; second <= 60; second++) {
    assert.equal(
      checkpointSignature('pilot', {
        ...pilot,
        active: { ...active, elapsedMs: second * 1000, phaseMs: second * 1000 },
      }),
      expected,
    );
  }
});
test('selection, assistance, phase and finalized explanation time still require a prompt save', () => {
  const expected = checkpointSignature('pilot', pilot);
  for (const patch of [
    { selected: 1 },
    { guess: true },
    { hintUsed: true },
    { phase: 'explanation' },
    { index: 1 },
  ]) {
    assert.notEqual(
      checkpointSignature('pilot', {
        ...pilot,
        active: { ...active, ...patch },
      }),
      expected,
    );
  }
  assert.notEqual(
    checkpointSignature('pilot', {
      ...pilot,
      attempts: [{ id: 'answer-one', explanationMs: 12000 }],
    }),
    checkpointSignature('pilot', {
      ...pilot,
      attempts: [{ id: 'answer-one', explanationMs: 10000 }],
    }),
  );
});
test('course notes, stages and lab inputs are never treated as pilot timer-only changes', () => {
  const course = {
    units: { one: { stage: 'understand', note: '', exploration: {} } },
    attempts: [],
  };
  const expected = checkpointSignature('course', course);
  for (const patch of [
    { note: 'My explanation' },
    { stage: 'predict' },
    { exploration: { measured: false } },
  ]) {
    assert.notEqual(
      checkpointSignature('course', {
        ...course,
        units: { one: { ...course.units.one, ...patch } },
      }),
      expected,
    );
  }
});
