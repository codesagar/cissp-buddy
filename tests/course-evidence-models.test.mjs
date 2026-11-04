import test from 'node:test';
import assert from 'node:assert/strict';
import {
  samplingModel,
  summarizeSample,
  accountEvidence,
  evidencePaths,
  eventTimelineModel,
  utcClock,
} from '../lib/course/evidence-models.ts';
test('reproducible stratified selections conserve declared populations and separate excluded groups', () => {
  for (const seed of ['0', '1', '20260630', '4294967295']) {
    const a = samplingModel(seed),
      b = samplingModel(seed);
    assert.equal(a.valid, true);
    assert.deepEqual(a, b);
    assert.equal(a.selected.length, 24);
    assert.equal(new Set(a.selected).size, 24);
    assert.equal(a.unselected, 216);
    for (const s of a.strata) {
      assert.equal(s.population.length, 80);
      assert.equal(s.selected.length, 8);
      assert(s.selected.every((id) => s.population.includes(id)));
    }
    assert.equal(a.serviceAccounts.length, 18);
    assert.equal(a.breakGlassAccounts.length, 7);
    assert.equal(
      new Set([...a.selected, ...a.serviceAccounts, ...a.breakGlassAccounts])
        .size,
      49,
    );
  }
  assert.notDeepEqual(samplingModel('1').selected, samplingModel('2').selected);
  for (const x of ['', '-1', '1.5', '4294967296', 'NaN'])
    assert.equal(samplingModel(x).valid, false);
});
test('sample results begin missing, conserve denominator, and never infer unselected outcomes', () => {
  const s = samplingModel('20260630'),
    e = {};
  assert.deepEqual(summarizeSample(s.selected, e), {
    pass: 0,
    failure: 0,
    missing: 24,
    exception: 0,
  });
  for (const path of evidencePaths) e[`${s.selected[0]}:${path}`] = 'pass';
  assert.equal(accountEvidence(s.selected[0], e), 'pass');
  e[`${s.selected[1]}:bypass`] = 'failure';
  e[`${s.selected[2]}:reset`] = 'exception';
  assert.deepEqual(summarizeSample(s.selected, e), {
    pass: 1,
    failure: 1,
    missing: 21,
    exception: 1,
  });
  const unselected = s.strata[0].population.find(
    (id) => !s.selected.includes(id),
  );
  for (const p of evidencePaths) e[`${unselected}:${p}`] = 'pass';
  assert.equal(summarizeSample(s.selected, e).pass, 1);
  assert.deepEqual(summarizeSample(s.serviceAccounts, e), {
    pass: 0,
    failure: 0,
    missing: 18,
    exception: 0,
  });
});
test('signed clock correction yields exact UTC intervals and justified pairwise order', () => {
  const t = eventTimelineModel('240', '2', true);
  assert.equal(t.valid, true);
  const db = t.events.find((e) => e.id === 'database');
  assert.equal(db.raw, 260);
  assert.equal(db.corrected, 20);
  assert.equal(utcClock(db.lower), '10:00:18');
  assert.equal(utcClock(db.upper), '10:00:22');
  assert.equal(t.precedence.length, 3);
  assert.equal(utcClock(-2), '09:59:58');
  assert.equal(utcClock(42), '10:00:42');
  const opposite = eventTimelineModel('-240', '2', true);
  assert.equal(opposite.events[1].corrected, 500);
  assert(
    opposite.precedence.some((p) => p.from === 'egress' && p.to === 'database'),
  );
});
test('unknown, overlapping, and touching intervals do not fabricate an exact event order', () => {
  const unknown = eventTimelineModel('240', '2', false);
  assert.equal(eventTimelineModel('', '', false).valid, true);
  assert.equal(eventTimelineModel('601', '-1', false).valid, true);
  assert.equal(unknown.events[1].corrected, null);
  assert.equal(unknown.events[1].lower, null);
  assert.deepEqual(
    unknown.precedence.map((p) => [p.from, p.to]),
    [['idp', 'egress']],
  );
  const overlap = eventTimelineModel('240', '25', true);
  assert.deepEqual(
    overlap.precedence.map((p) => [p.from, p.to]),
    [['idp', 'egress']],
  );
  const touching = eventTimelineModel('240', '18', true);
  assert.deepEqual(
    touching.precedence.map((p) => [p.from, p.to]),
    [['idp', 'egress']],
  );
  for (const [offset, u] of [
    ['', '2'],
    ['601', '2'],
    ['240', '-1'],
    ['240', '121'],
    ['240', '0.5'],
  ])
    assert.equal(eventTimelineModel(offset, u, true).valid, false);
  // Exhaust the finite legal input grid: 1,201 offsets × 121 uncertainties.
  for (let offset = -600; offset <= 600; offset += 1)
    for (let u = 0; u <= 120; u += 1) {
      const m = eventTimelineModel(String(offset), String(u), true);
      assert(m.max > m.min);
      assert(m.events.every((e) => e.lower >= m.min && e.upper <= m.max));
    }
});
