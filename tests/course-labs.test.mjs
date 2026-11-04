import test from 'node:test';
import assert from 'node:assert/strict';
import {
  denominatorModel,
  authorizationModel,
} from '../lib/course/lab-models.ts';
test('all 231 legal evidence states conserve the population and constrain rates', () => {
  let states = 0;
  for (let p = 0; p <= 20; p++)
    for (let u = 0; u <= 20 - p; u++) {
      const known = denominatorModel(String(p), String(u), 'known');
      const census = denominatorModel(String(p), String(u), 'census');
      assert.ok(known.valid && census.valid);
      assert.equal(known.patched + known.unpatched + known.unknown, 120);
      assert.equal(known.patched, 98 + p);
      assert.equal(known.unpatched, 2 + u);
      assert.equal(known.unknown, 20 - p - u);
      assert.equal(known.lower, census.lower);
      assert.equal(known.upper, census.upper);
      assert.equal(known.rate, (100 * (98 + p)) / (100 + p + u));
      assert.equal(census.rate, census.lower);
      assert.ok(known.lower <= known.upper && known.upper <= 100);
      assert.equal(known.lower === known.upper, p + u === 20);
      states++;
    }
  assert.equal(states, 231);
});
test('report scope changes no asset status; missing census withdraws fleet bounds', () => {
  const a = denominatorModel('5', '4', 'known'),
    b = denominatorModel('5', '4', 'census');
  for (const key of ['patched', 'unpatched', 'unknown', 'total'])
    assert.equal(a[key], b[key]);
  assert.notEqual(a.rate, b.rate);
  const unknown = denominatorModel('5', '4', 'census', false);
  assert.equal(unknown.lower, null);
  assert.equal(unknown.upper, null);
});
test('invalid evidence counts fail explicitly rather than silently clamping', () => {
  for (const [p, u] of [
    ['', '0'],
    ['0', ''],
    ['-1', '0'],
    ['0', '21'],
    ['1.5', '0'],
    ['20', '1'],
    ['NaN', '1'],
    ['Infinity', '0'],
  ])
    assert.equal(denominatorModel(p, u, 'known').valid, false);
});
test('all nine authorization input combinations enforce the stated conjunction', () => {
  for (const assigned of ['yes', 'no', 'unknown'])
    for (const device of ['yes', 'no', 'unknown']) {
      const result = authorizationModel(assigned, device);
      assert.equal(result.permit, assigned === 'yes' && device === 'yes');
      assert.equal(result.decision, result.permit ? 'Permit' : 'Deny');
      if (assigned === 'unknown' || device === 'unknown')
        assert.match(result.reason, /unknown/);
    }
});
