/** Current static release gates. Historical validators/reports are preserved, never rerun in place. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyStaticOutput } from './verify-static-output.mjs';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = path.dirname(webRoot.replace(/\/$/, ''));
const outputRoot = path.join(webRoot, 'outputs/static-qa');
const manifest = JSON.parse(
  fs.readFileSync(path.join(webRoot, 'lib/data/course/manifest.json'), 'utf8'),
);
const expectedRelease =
  process.argv
    .find((argument) => argument.startsWith('--expected-release='))
    ?.slice('--expected-release='.length) || manifest.releaseId;
assert.equal(
  expectedRelease,
  manifest.releaseId,
  'Requested release matches generated source',
);
const requestedPort = process.argv
  .find((argument) => argument.startsWith('--port='))
  ?.slice('--port='.length);
const port = requestedPort ? Number(requestedPort) : 0;
assert.ok(
  Number.isInteger(port) && port >= 0 && port <= 65535,
  'Port is an integer from 0 to 65535',
);
const output = (name) => path.join(outputRoot, name);
const node = process.execPath;
const commands = [
  {
    id: 'content-and-deterministic-generation',
    command: ['npm', 'run', 'content:validate'],
  },
  { id: 'typecheck', command: ['npm', 'run', 'typecheck'] },
  { id: 'lint', command: ['npm', 'run', 'lint'] },
  { id: 'learning-recovery-content-and-model-tests', command: ['npm', 'test'] },
  {
    id: 'all-model-react-rendering',
    command: [
      'npm',
      'run',
      'course:render-check',
      '--',
      `--output=${output('all-state-react-render-check.json')}`,
    ],
  },
  {
    id: 'source-bound-coverage',
    command: [
      node,
      'scripts/generate-course-coverage.mjs',
      `--expected-release=${expectedRelease}`,
      `--output=${output('coverage.json')}`,
    ],
  },
  { id: 'root-production-build', command: ['npm', 'run', 'build'] },
];
const subpathBuild = {
  id: 'subpath-production-build',
  command: [
    'npm',
    'run',
    'build',
    '--',
    '--base=/cissp-qa/',
    '--outDir=outputs/static-qa/subpath',
  ],
};
if (process.argv.includes('--plan')) {
  console.log(
    JSON.stringify(
      {
        expectedRelease,
        outputRoot,
        commands: [...commands, subpathBuild],
        staticVerification: ['/', '/cissp-qa/'],
        historicalReportWrites: false,
        localDatabaseRequired: false,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const filesUnder = (directory) =>
  fs.existsSync(directory)
    ? fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory()
          ? filesUnder(file)
          : entry.isFile()
            ? [file]
            : [];
      })
    : [];
const protectedFiles = new Map(
  [
    ...filesUnder(
      path.join(repositoryRoot, 'planning/visual-learning-production'),
    ),
    ...filesUnder(
      path.join(repositoryRoot, 'planning/visual-explanation-implementation'),
    ),
    ...filesUnder(path.join(repositoryRoot, 'knowledge/quality')),
  ].map((file) => [file, sha256(fs.readFileSync(file))]),
);
fs.mkdirSync(outputRoot, { recursive: true });
const results = [];
const run = ({ id, command }) => {
  const startedAt = Date.now();
  const child = spawnSync(command[0], command.slice(1), {
    cwd: webRoot,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const combined = `${child.stdout || ''}${child.stderr || ''}`;
  const receipt = {
    id,
    command,
    status: child.status === 0 ? 'pass' : 'fail',
    exitCode: child.status,
    durationMs: Date.now() - startedAt,
    outputSha256: sha256(combined),
    outputTail: combined.slice(-10000),
  };
  results.push(receipt);
  if (child.status !== 0) {
    console.error(combined);
    throw new Error(
      `${id} failed${child.error ? `: ${child.error.message}` : ''}.`,
    );
  }
  console.log(`${id}: pass`);
};
const report = {
  schemaVersion: 1,
  releaseId: manifest.releaseId,
  sourceHash: manifest.sourceHash,
  checkedAt: new Date().toISOString(),
  status: 'running',
  results,
  staticOutput: [],
  limits:
    'Automated exhaustive content/model/static-HTTP checks. Actual browser interaction, readable visual sampling and independent review are separate evidence; no human expert or learning-effectiveness claim.',
};
try {
  for (const command of commands) run(command);
  report.staticOutput.push(
    await verifyStaticOutput({
      directory: path.join(webRoot, 'dist'),
      expectedRelease,
      base: '/',
      port,
    }),
  );
  console.log('root-static-output-and-http: pass');
  run(subpathBuild);
  report.staticOutput.push(
    await verifyStaticOutput({
      directory: output('subpath'),
      expectedRelease,
      base: '/cissp-qa/',
      port,
    }),
  );
  console.log('subpath-static-output-and-http: pass');
  const coverage = JSON.parse(fs.readFileSync(output('coverage.json'), 'utf8'));
  assert.equal(coverage.releaseId, manifest.releaseId);
  assert.equal(
    coverage.reviewBinding.currentSourceMatchesRelease,
    true,
    'Coverage binds current authored sources to release',
  );
  report.coverage = {
    sha256: sha256(fs.readFileSync(output('coverage.json'))),
    counts: coverage.counts,
    assessmentCoverage: {
      unitChecks: coverage.assessmentCoverage.unit.rows.length,
      connectionChecks: coverage.assessmentCoverage.connection.rows.length,
    },
    historicalReviewBindingStatus: coverage.reviewBinding.status,
  };
  report.status = 'pass';
} catch (error) {
  report.status = 'fail';
  report.error = error.message;
  process.exitCode = 1;
} finally {
  const changed = [...protectedFiles]
    .filter(
      ([file, hash]) =>
        !fs.existsSync(file) || sha256(fs.readFileSync(file)) !== hash,
    )
    .map(([file]) => path.relative(repositoryRoot, file));
  report.protectedHistoricalFiles = { checked: protectedFiles.size, changed };
  if (changed.length) {
    report.status = 'fail';
    report.error = `Protected historical reports changed: ${changed.join(', ')}`;
    process.exitCode = 1;
  }
  fs.writeFileSync(
    output('validation.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify(
      {
        status: report.status,
        report: output('validation.json'),
        error: report.error,
      },
      null,
      2,
    ),
  );
}
