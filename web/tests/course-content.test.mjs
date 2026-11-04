import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generatedCourseConnections,
  generatedCourseConnectionsIndex,
  generatedCourseManifest,
  generatedCourseSourceBindings,
  generatedCourseUnits,
} from '../lib/data/course/release.ts';
import {
  validateCourseConnections,
  validateCourseRelease,
  validateCourseUnit,
} from '../lib/course/validate.ts';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  return value;
};
const semanticHash = (value) =>
  createHash('sha256')
    .update(`${JSON.stringify(stable(value))}\n`)
    .digest('hex');

test('generated course has complete canonical coverage and substantive mappings', () => {
  const manifest = validateCourseRelease(
    generatedCourseManifest,
    generatedCourseUnits,
    true,
  );
  assert.deepEqual(manifest.counts, {
    assessments: manifest.counts.teachingModels * 3,
    conceptOccurrences: 892,
    concepts: 698,
    teachingModels: manifest.counts.teachingModels,
    units: 90,
  });
  assert.equal(generatedCourseSourceBindings.occurrences.length, 892);
  const bindings = new Map(
    generatedCourseSourceBindings.occurrences.map((binding) => [
      `${binding.unitId}::${binding.conceptId}`,
      binding,
    ]),
  );
  assert.equal(bindings.size, 892);
  for (const unit of generatedCourseUnits) {
    assert.equal(unit.releaseId, manifest.releaseId);
    assert.equal(unit.concepts.length, unit.conceptIds.length);
    for (const concept of unit.concepts) {
      assert.ok(concept.definition.length > 8);
      assert.ok(concept.decision.length > 8);
      assert.ok(concept.failureExample.length > 8);
      assert.ok(concept.sourceVisualId);
      assert.ok(concept.sourceRefIds.length > 0);
      const binding = bindings.get(`${unit.id}::${concept.id}`);
      assert.ok(binding);
      assert.equal(binding.sourceVisualId, concept.sourceVisualId);
      assert.deepEqual(binding.sourceRefIds, concept.sourceRefIds);
    }
  }
});

test('source bindings resolve to unchanged canonical visual rows', () => {
  const checkedFiles = new Map();
  for (const binding of generatedCourseSourceBindings.occurrences) {
    assert.match(
      binding.sourceVisualPath,
      /^knowledge\/domains\/d[1-8]-[^/]+\/visuals\/.+\.json$/,
    );
    assert.ok(
      binding.bindingKind === 'unit-visual-row' ||
        binding.bindingKind === 'shared-visual-row',
    );
    assert.ok(
      binding.derivedFields.every((field) =>
        ['definition', 'decision', 'failureExample'].includes(field),
      ),
    );
    if (!checkedFiles.has(binding.sourceVisualPath)) {
      const bytes = fs.readFileSync(
        path.join(repositoryRoot, binding.sourceVisualPath),
      );
      checkedFiles.set(
        binding.sourceVisualPath,
        createHash('sha256').update(bytes).digest('hex'),
      );
    }
    assert.equal(
      checkedFiles.get(binding.sourceVisualPath),
      binding.sourceVisualHash,
    );
  }
  assert.equal(
    checkedFiles.size,
    new Set(
      generatedCourseSourceBindings.occurrences.map(
        (binding) => binding.sourceVisualPath,
      ),
    ).size,
  );
  assert.ok(checkedFiles.size >= 90);
});

test('assessment identities bind the complete authored check semantics', () => {
  const bindings = generatedCourseSourceBindings.assessments;
  assert.equal(
    bindings.length,
    generatedCourseManifest.counts.assessments +
      generatedCourseConnections.length * 3,
  );
  assert.equal(
    new Set(bindings.map((binding) => binding.productionId)).size,
    bindings.length,
  );
  for (const binding of bindings) {
    assert.match(binding.authoredCheckHash, /^[a-f0-9]{64}$/);
    assert.equal(
      binding.productionId,
      `${binding.authoredId}-${binding.authoredCheckHash.slice(0, 12)}`,
    );
    assert.match(binding.contentKind, /^(?:unit|connection)$/);
    assert.equal(binding.contentId, binding.unitId || binding.connectionId);
    assert.match(
      binding.sourceTeachingPath,
      binding.contentKind === 'unit'
        ? /^web\/lib\/data\/teaching\/.+\.json$/
        : /^web\/lib\/data\/connections\/cross-.+\.json$/,
    );
    assert.match(binding.sourceTeachingHash, /^[a-f0-9]{64}$/);
    const sourceBytes = fs.readFileSync(
      path.join(repositoryRoot, binding.sourceTeachingPath),
    );
    assert.equal(
      createHash('sha256').update(sourceBytes).digest('hex'),
      binding.sourceTeachingHash,
    );
    const authoredModel = JSON.parse(sourceBytes);
    const authoredCheck = authoredModel[binding.phase];
    assert.equal(authoredCheck.id, binding.authoredId);
    assert.equal(semanticHash(authoredCheck), binding.authoredCheckHash);
    const generatedModel =
      binding.contentKind === 'unit'
        ? generatedCourseUnits.find(({ id }) => id === binding.unitId)?.teaching
        : generatedCourseConnections.find(
            ({ id }) => id === binding.connectionId,
          )?.model;
    assert.ok(generatedModel);
    assert.equal(generatedModel[binding.phase].id, binding.productionId);
    assert.deepEqual(generatedModel[binding.phase], {
      ...authoredCheck,
      id: binding.productionId,
    });
  }
});

test('visual explanation review repairs are complete and versioned', () => {
  const models = [
    ...generatedCourseUnits.map((unit) => unit.teaching),
    ...generatedCourseConnections.map((connection) => connection.model),
  ].filter(Boolean);
  assert.equal(
    models.filter((model) => model.learningJob).length,
    78,
    'every non-retain coverage row has an authored teaching job',
  );
  for (const model of models.filter((item) => item.learningJob))
    for (const option of model.transfer.options)
      assert.doesNotMatch(
        option.feedback,
        /Recompute the decision from|model[’']s .+ relation/i,
      );

  const admission = generatedCourseUnits.find(
    (unit) => unit.id === 'd4-o02-components-and-endpoints',
  ).teaching;
  assert.match(admission.prediction.id, /prediction-v2-/);
  assert.doesNotMatch(
    JSON.stringify(admission.prediction),
    /switch|chassis|hardware duplication/i,
  );
  assert.match(
    JSON.stringify(admission.prediction),
    /admission|posture|segment|endpoint|session/i,
  );

  const investigation = generatedCourseUnits.find(
    (unit) => unit.id === 'd1-o05-investigation-types',
  ).teaching;
  assert.deepEqual(
    investigation.matrix.rows.map((row) => row.id),
    ['administrative', 'criminal', 'civil', 'regulatory', 'standards'],
  );
  assert.match(
    investigation.evidenceRecord.note,
    /(?:does not create|grants no) collection/i,
  );
  assert.match(investigation.prediction.id, /prediction-v2-/);

  const matrixIds = new Set(
    models.filter((model) => model.matrix).map((model) => model.unitId),
  );
  for (const id of [
    'd2-o06-controls-compliance',
    'd3-o05-architecture-vulnerabilities',
    'd4-o01-architecture-and-segmentation',
    'd4-o01-network-protocol-routing-design',
    'd7-o10-recovery-strategy-selection',
    'd7-o12-disaster-recovery-exercise-design',
    'd7-o12-dr-plan-testing',
    'd8-o05-secure-coding-foundations',
  ])
    assert.ok(matrixIds.has(id), `${id} has its coordinated comparison`);
});

test('connection release validates the exact taught and reference partition', () => {
  const index = validateCourseConnections(
    generatedCourseConnectionsIndex,
    generatedCourseConnections,
    generatedCourseUnits,
    true,
  );
  assert.equal(index.releaseId, generatedCourseManifest.releaseId);
  assert.equal(index.cases.length, 11);
  assert.equal(generatedCourseConnections.length, 11);
  assert.equal(index.referenceRelationships.length, 21);
  assert.equal(
    index.cases.reduce((count, item) => count + item.relationshipIds.length, 0),
    18,
  );
});

test('authored connection checks use balanced answers and distinct retry cases', () => {
  const sourceIndex = JSON.parse(
    fs.readFileSync(
      path.join(repositoryRoot, 'web/lib/data/connections/index.json'),
      'utf8',
    ),
  );
  const positions = [0, 0, 0];
  const sourceConnections = [];
  const blockedPaths = [];
  for (const item of sourceIndex) {
    const model = JSON.parse(
      fs.readFileSync(
        path.join(repositoryRoot, `web/lib/data/connections/${item.id}.json`),
        'utf8',
      ),
    );
    sourceConnections.push({
      releaseId: 'source-review',
      ...item,
      model,
    });
    assert.equal(model.variants.length, 2);
    for (const variant of model.variants) {
      assert.ok(variant.nodes?.length > 0);
      assert.ok(variant.edges?.length > 0);
      assert.ok(variant.lanes?.length > 0);
    }
    for (const [scope, graph] of [
      ['base', model],
      ...model.variants.map((variant) => [variant.id, variant]),
    ]) {
      const labels = new Map(
        (graph.nodes || model.nodes).map((node) => [node.id, node.label]),
      );
      for (const edge of graph.edges || model.edges)
        if (edge.kind === 'blocked')
          blockedPaths.push(
            `${item.id}/${scope}: ${labels.get(edge.from)} -> ${labels.get(edge.to)}`,
          );
    }
    assert.equal(
      model.variants.filter((variant) => variant.id === 'retry-case').length,
      1,
    );
    for (const phase of ['prediction', 'transfer', 'retry']) {
      const correctIndex = model[phase].options.findIndex(
        (option) => option.correct,
      );
      assert.ok(correctIndex >= 0);
      positions[correctIndex] += 1;
      const lengths = model[phase].options.map((option) => option.label.length);
      assert.ok(Math.max(...lengths) / Math.min(...lengths) <= 1.8);
    }
  }
  assert.deepEqual(positions, [11, 11, 11]);
  assert.deepEqual(blockedPaths.sort(), [
    'cross-asset-data-lifecycle--copy-disposition/base: Backup copy -> Execute and verify disposition',
    'cross-identity-trust--request-enforcement/base: Segment gateway / PEP -> Production payroll database',
    'cross-operations-recovery--service-recovery/base: Identity provider -> End-to-end service validation',
    'cross-operations-recovery--service-recovery/retry-case: Transaction passes; data limit fails -> Continuity acceptance held',
    'cross-operations-recovery--service-recovery/transfer-case: External payment gateway unavailable -> Paid-order path validation',
  ]);
  const referenceRelationships = JSON.parse(
    fs.readFileSync(
      path.join(
        repositoryRoot,
        'web/lib/data/connections/reference-relationships.json',
      ),
      'utf8',
    ),
  );
  assert.equal(
    validateCourseConnections(
      {
        releaseId: 'source-review',
        cases: sourceIndex,
        referenceRelationships,
      },
      sourceConnections,
      generatedCourseUnits,
      true,
    ).cases.length,
    11,
  );
});

test('recovery timeline validation distinguishes restoration from acceptance', () => {
  const unit = structuredClone(generatedCourseUnits[0]);
  unit.teaching.quantitative = {
    kind: 'recovery-timeline',
    unit: 'hours',
    lastRecoverableAt: -0.5,
    interruptionAt: 0,
    rpoLimit: 1,
    restoreAt: 2,
    rtoLimit: 4,
    disruptionLimit: 8,
    acceptanceAt: 3.5,
    description: 'Restoration precedes business acceptance.',
  };
  assert.equal(validateCourseUnit(unit), unit);
  unit.teaching.quantitative.acceptanceAt = 1.5;
  assert.throws(
    () => validateCourseUnit(unit),
    /invalid recovery timeline values/,
  );
});

test('manifest stays bounded and excludes individual unit payloads', () => {
  const json = JSON.stringify(generatedCourseManifest);
  assert.ok(
    Buffer.byteLength(json) < 160_000,
    'outline stays bounded with prerequisite and named-check scope metadata',
  );
  assert.equal('sections' in generatedCourseManifest.units[0], false);
  assert.equal('concepts' in generatedCourseManifest.units[0], false);
  assert.equal('teaching' in generatedCourseManifest.units[0], false);
});

test('course generation is deterministic and checked into source control', () => {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/generate-course.mjs', '--check'],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('release identity changes when content changes and carries the hash prefix', () => {
  assert.match(generatedCourseManifest.sourceHash, /^[a-f0-9]{64}$/);
  assert.ok(
    generatedCourseManifest.releaseId.endsWith(
      generatedCourseManifest.sourceHash.slice(0, 16),
    ),
  );
  assert.equal(
    new Set(generatedCourseUnits.map((unit) => unit.sourceHash)).size,
    90,
  );
});

test('manifest recommendation metadata binds exact prerequisites and scoped named checks', () => {
  for (const unit of generatedCourseUnits) {
    const summary = generatedCourseManifest.units.find(
      ({ id }) => id === unit.id,
    );
    assert.deepEqual(summary.prerequisites, unit.prerequisites);
    assert.deepEqual(
      summary.checks,
      unit.teaching
        ? [
            unit.teaching.prediction,
            unit.teaching.transfer,
            unit.teaching.retry,
          ].map(({ id, conceptIds }) => ({ id, conceptIds }))
        : [],
    );
    for (const check of summary.checks)
      assert.ok(check.conceptIds.every((id) => unit.conceptIds.includes(id)));
  }
});
