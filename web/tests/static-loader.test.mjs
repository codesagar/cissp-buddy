import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  loadManifest,
  loadUnit,
  loadConnection,
  loadConnectionsIndex,
  loadPilot,
  appUrl,
} from '../lib/course/static-loader.ts';
const read = (name) =>
  JSON.parse(
    fs.readFileSync(
      new URL(`../lib/data/course/${name}`, import.meta.url),
      'utf8',
    ),
  );
const manifest = read('manifest.json');
const unit = read(`units/${manifest.units[0].id}.json`);
const index = read('connections-index.json');
const connection = read(`connections/${index.cases[0].id}.json`);
const withFetch = async (response, work) => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return typeof response === 'function' ? response(url) : response;
  };
  try {
    await work(requests);
  } finally {
    globalThis.fetch = original;
  }
};
test('static loading remains lazy and pins each lesson to the loaded release', async () => {
  await withFetch(new Response(JSON.stringify(manifest)), async (requests) => {
    assert.equal((await loadManifest()).releaseId, manifest.releaseId);
    assert.deepEqual(
      requests.map(({ url }) => url),
      ['/content/course/manifest.json'],
    );
  });
  await withFetch(new Response(JSON.stringify(unit)), async (requests) => {
    assert.equal((await loadUnit(manifest, unit.id)).id, unit.id);
    assert.equal(
      requests[0].url,
      `/content/course/${manifest.releaseId}/units/${unit.id}.json`,
    );
  });
  assert.equal(appUrl('pilot/#/practice'), '/pilot/#/practice');
});
test('static loaders reject unavailable, damaged, mismatched and changed-question content', async () => {
  for (const response of [
    new Response('missing', { status: 404 }),
    new Response('<html>error</html>'),
    new Response('{}'),
  ])
    await withFetch(response, async () => assert.rejects(loadManifest()));
  for (const mutate of [
    (u) => (u.id = 'another-unit'),
    (u) => (u.releaseId = 'old-release'),
    (u) => (u.teaching.prediction.id += '-changed'),
    (u) => (u.teaching.prediction.options[0].label += ' changed semantics'),
  ]) {
    const altered = structuredClone(unit);
    mutate(altered);
    await withFetch(new Response(JSON.stringify(altered)), async () =>
      assert.rejects(loadUnit(manifest, unit.id)),
    );
  }
  await withFetch(
    new Response(JSON.stringify({ ...index, releaseId: 'old-release' })),
    async () => assert.rejects(loadConnectionsIndex(manifest)),
  );
  await withFetch(
    new Response(JSON.stringify({ ...connection, releaseId: 'old-release' })),
    async () => assert.rejects(loadConnection(manifest, connection.id)),
  );
  await withFetch(
    new Response(JSON.stringify({ releaseId: 'changed-pilot' })),
    async () => assert.rejects(loadPilot()),
  );
});
test('connection index and detail load separately and abort is preserved', async () => {
  await withFetch(new Response(JSON.stringify(index)), async () =>
    assert.equal((await loadConnectionsIndex(manifest)).cases.length, 11),
  );
  await withFetch(new Response(JSON.stringify(connection)), async () =>
    assert.equal(
      (await loadConnection(manifest, connection.id)).id,
      connection.id,
    ),
  );
  const controller = new AbortController();
  controller.abort();
  await withFetch(
    (_url) => Promise.reject(new DOMException('Aborted', 'AbortError')),
    async () =>
      assert.rejects(loadManifest(controller.signal), { name: 'AbortError' }),
  );
});

test('malformed outline metadata fails before any learner screen renders', async () => {
  const mutations = [
    (m) => (m.domains[0] = {}),
    (m) => (m.domains[1].id = m.domains[0].id),
    (m) => m.counts.assessments++,
    (m) => delete m.units[0].outcome,
    (m) => (m.units[0].estimatedMinutes = 0),
    (m) => (m.units[0].teachingReady = 'yes'),
    (m) => (m.units[0].checks[0].conceptIds = ['unscoped-concept']),
    (m) => (m.units[0].checks[1].id = m.units[0].checks[0].id),
    (m) => (m.units[0].prerequisites = ['unknown-concept']),
  ];
  for (const mutate of mutations) {
    const altered = structuredClone(manifest);
    mutate(altered);
    await withFetch(new Response(JSON.stringify(altered)), async () =>
      assert.rejects(loadManifest()),
    );
  }
});

test('malformed linked-case models and reference rows reject before rendering', async () => {
  for (const mutate of [
    (c) => {
      c.model.edges = null;
      c.model.states = [null];
    },
    (c) => (c.model.edges[0].to = 'missing-node'),
    (c) => (c.model.states[0].activeNodeIds = ['missing-node']),
    (c) => (c.model.variants[0].states = [null]),
    (c) => (c.model.prediction.options = null),
    (c) => (c.unitIds = ['missing-unit']),
  ]) {
    const altered = structuredClone(connection);
    mutate(altered);
    await withFetch(new Response(JSON.stringify(altered)), async () =>
      assert.rejects(loadConnection(manifest, connection.id)),
    );
  }
  for (const mutate of [
    (i) => (i.referenceRelationships[0] = null),
    (i) => (i.referenceRelationships[0].sourceSupport = null),
    (i) => (i.referenceRelationships[0].reason = 4),
    (i) => (i.referenceRelationships[1].id = i.referenceRelationships[0].id),
    (i) => (i.cases[0].unitIds = ['missing-unit']),
  ]) {
    const altered = structuredClone(index);
    mutate(altered);
    await withFetch(new Response(JSON.stringify(altered)), async () =>
      assert.rejects(loadConnectionsIndex(manifest)),
    );
  }
});

test('ordinary Vite development serves real packaged JSON at root and project paths', async () => {
  const { createServer } = await import('vite');
  for (const base of ['/', '/dev-course/']) {
    const server = await createServer({
      base,
      server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
    });
    try {
      await server.listen();
      const address = server.httpServer.address();
      const origin = `http://127.0.0.1:${address.port}${base}`;
      for (const [path, expectedId] of [
        ['content/course/manifest.json', manifest.releaseId],
        [
          `content/course/${manifest.releaseId}/units/${unit.id}.json`,
          manifest.releaseId,
        ],
        [
          `content/course/${manifest.releaseId}/connections/${connection.id}.json`,
          manifest.releaseId,
        ],
        [
          'content/pilot/cissp-foundations-2026-09-06-r2.json',
          'cissp-foundations-2026-09-06-r2',
        ],
      ]) {
        const response = await fetch(origin + path);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /json/);
        assert.equal((await response.json()).releaseId, expectedId);
      }
      const favicon = await fetch(origin + 'favicon.svg');
      assert.equal(favicon.status, 200);
      assert.match(favicon.headers.get('content-type'), /svg/);
    } finally {
      await server.close();
    }
  }
});
