import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateFirebaseConfiguration,
  loadFirebaseConfiguration,
} from '../lib/learner/firebase-config.ts';
const real = {
  enabled: true,
  firebase: {
    apiKey: 'public-test-key',
    authDomain: 'cissp-buddy.firebaseapp.com',
    projectId: 'cissp-buddy',
    appId: '1:123:web:test',
  },
  ownerUid: 'owner-test',
  emulators: false,
};
test('disabled or absent account config preserves guest-only learning', async () => {
  assert.equal(
    validateFirebaseConfiguration({ enabled: false }, 'codesagar.github.io'),
    null,
  );
  assert.equal(
    await loadFirebaseConfiguration(
      '/project/firebase-config.json',
      'codesagar.github.io',
      async () => new Response('', { status: 404 }),
    ),
    null,
  );
});
test('account config refuses credentials, foreign auth helpers and nonlocal or real-project emulators', () => {
  for (const mutate of [
    (v) => (v.privateKey = 'secret'),
    (v) => (v.firebase.private_key = 'secret'),
    (v) => (v.firebase.authDomain = 'attacker.example'),
    (v) => (v.ownerUid = 'invalid/uid'),
    (v) => (v.emulators = true),
  ]) {
    const copy = structuredClone(real);
    mutate(copy);
    assert.throws(() =>
      validateFirebaseConfiguration(copy, 'codesagar.github.io'),
    );
  }
  const demo = structuredClone(real);
  demo.emulators = true;
  demo.firebase.projectId = 'demo-cissp-buddy';
  demo.firebase.authDomain = 'demo-cissp-buddy.firebaseapp.com';
  assert.equal(
    validateFirebaseConfiguration(demo, '127.0.0.1').emulators,
    true,
  );
  assert.throws(() =>
    validateFirebaseConfiguration(demo, 'codesagar.github.io'),
  );
  assert.throws(() =>
    validateFirebaseConfiguration({ ...demo, emulators: false }, 'localhost'),
  );
  assert.throws(() =>
    validateFirebaseConfiguration({ ...real, emulators: true }, 'localhost'),
  );
});
test('an unknown owner permits identity bootstrap but is not silently invented', () => {
  const valid = validateFirebaseConfiguration(
    { ...real, ownerUid: '' },
    'codesagar.github.io',
  );
  assert.equal(valid.ownerUid, '');
});
test('damaged and failed config responses do not become a configured empty account', async () => {
  for (const response of [
    new Response('{}'),
    new Response('<html>fallback</html>'),
    new Response('', { status: 503 }),
  ])
    await assert.rejects(
      loadFirebaseConfiguration(
        '/repository/firebase-config.json',
        'codesagar.github.io',
        async () => response,
      ),
    );
  let requested;
  await loadFirebaseConfiguration(
    '/repository/firebase-config.json',
    'codesagar.github.io',
    async (url) => {
      requested = url;
      return new Response(JSON.stringify(real));
    },
  );
  assert.equal(requested, '/repository/firebase-config.json');
});
