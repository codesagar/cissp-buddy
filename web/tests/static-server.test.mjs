import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startStaticServer } from '../scripts/static-server.mjs';

test('ordinary static server honors directory entries, subpaths, and real missing files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cissp-static-server-'));
  await fs.mkdir(path.join(root, 'pilot'));
  await fs.writeFile(path.join(root, 'index.html'), '<h1>Main</h1>');
  await fs.writeFile(path.join(root, 'pilot/index.html'), '<h1>Pilot</h1>');
  await fs.writeFile(
    path.join(root, 'manifest.json'),
    '{"releaseId":"synthetic"}',
  );
  const instance = await startStaticServer(root, { base: '/course/' });
  try {
    const rootResponse = await fetch(instance.baseUrl + '#/today');
    assert.equal(rootResponse.status, 200);
    assert.match(await rootResponse.text(), /Main/);
    const pilot = await fetch(instance.baseUrl + 'pilot/#/practice');
    assert.equal(pilot.status, 200);
    assert.match(await pilot.text(), /Pilot/);
    const json = await fetch(instance.baseUrl + 'manifest.json');
    assert.match(json.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await json.json(), { releaseId: 'synthetic' });
    for (const url of [
      instance.origin + '/',
      instance.baseUrl + 'missing.json',
      instance.baseUrl + 'unit/missing',
      instance.baseUrl + '%2e%2e%2foutside',
    ])
      assert.equal((await fetch(url)).status, 404, url);
    assert.equal(
      (await fetch(instance.baseUrl + 'pilot', { redirect: 'manual' })).status,
      301,
    );
  } finally {
    await instance.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
