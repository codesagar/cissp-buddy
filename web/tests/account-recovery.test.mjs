import '../scripts/qa-tsx-loader.mjs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyLearnerState,
  validateLearnerState,
} from '../lib/course/learner-state.ts';
registerHooks({
  load(url, context, next) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : next(url, context);
  },
});
const { readAccountRecovery, writeAccountRecovery } =
  await import('../lib/learner/hooks.ts');
const key = 'cissp-buddy:account:demo-cissp:owner:course:v1';
function fixture(raw) {
  const records = new Map([
    [key, raw],
    ['cissp-buddy:course:v1', 'untouched-guest'],
  ]);
  let writes = 0;
  return {
    records,
    get writes() {
      return writes;
    },
    getItem: (k) => records.get(k) ?? null,
    setItem(k, value) {
      writes++;
      records.set(k, value);
    },
  };
}
test('unreadable account copies survive valid cloud hydration and automatic save attempts byte-for-byte', () => {
  for (const raw of [
    '{damaged',
    JSON.stringify({ version: 1, dirty: false, state: { version: 999 } }),
  ]) {
    const storage = fixture(raw);
    assert.equal(
      readAccountRecovery(storage, key, validateLearnerState).kind,
      'unreadable',
    );
    assert.equal(
      writeAccountRecovery(
        storage,
        key,
        emptyLearnerState(),
        false,
        validateLearnerState,
        true,
      ),
      false,
    );
    assert.equal(storage.getItem(key), raw);
    assert.equal(storage.writes, 0);
    assert.equal(storage.getItem('cissp-buddy:course:v1'), 'untouched-guest');
  }
});
test('replacement requires explicit selection and a valid complete learner record', () => {
  const storage = fixture('{original');
  assert.throws(() =>
    writeAccountRecovery(
      storage,
      key,
      { version: 999 },
      false,
      validateLearnerState,
      true,
      true,
    ),
  );
  assert.equal(storage.getItem(key), '{original');
  assert.equal(
    writeAccountRecovery(
      storage,
      key,
      emptyLearnerState(),
      false,
      validateLearnerState,
      true,
      true,
    ),
    true,
  );
  assert.equal(
    readAccountRecovery(storage, key, validateLearnerState).kind,
    'valid',
  );
  assert.equal(storage.getItem('cissp-buddy:course:v1'), 'untouched-guest');
});
test('blocked storage is not interpreted as an absent account recovery record', () => {
  const storage = {
    getItem() {
      throw Error('blocked');
    },
  };
  assert.equal(
    readAccountRecovery(storage, key, validateLearnerState).kind,
    'unreadable',
  );
});
