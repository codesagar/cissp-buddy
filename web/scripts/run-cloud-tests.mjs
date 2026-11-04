/** Start only local demo emulators; production projects/credentials are never selected. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = path.dirname(webRoot.replace(/\/$/, ''));
const output = path.join(webRoot, 'outputs/cloud-tests');
fs.mkdirSync(output, { recursive: true });
const require = createRequire(import.meta.url);
const firebase = path.join(
  path.dirname(require.resolve('firebase-tools/package.json')),
  'lib/bin/firebase.js',
);
const testFiles = ['cloud-rules.test.mjs', 'learner-cloud-store.test.mjs'].map(
  (file) => fileURLToPath(new URL(`../tests/${file}`, import.meta.url)),
);
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const java21 = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
const env = {
  ...process.env,
  CISSP_CLOUD_TESTS: '1',
  GCLOUD_PROJECT: 'demo-cissp-buddy',
  CI: 'true',
};
if (!env.JAVA_HOME && fs.existsSync(java21)) env.JAVA_HOME = java21;
const result = spawnSync(
  process.execPath,
  [
    firebase,
    'emulators:exec',
    '--project',
    'demo-cissp-buddy',
    '--config',
    path.join(repositoryRoot, 'firebase.json'),
    '--only',
    'auth,firestore',
    `${quote(process.execPath)} --experimental-strip-types --test --test-concurrency=1 ${testFiles.map(quote).join(' ')}`,
  ],
  { cwd: output, env, stdio: 'inherit' },
);
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
