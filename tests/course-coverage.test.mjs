import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const webRoot = process.cwd();

test('coverage generator binds every production denominator to one release', () => {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(webRoot, 'lib/data/course/manifest.json'),
      'utf8',
    ),
  );
  const output = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'cissp-coverage-')),
    'coverage.json',
  );
  const result = spawnSync(
    process.execPath,
    [
      'scripts/generate-course-coverage.mjs',
      `--expected-release=${manifest.releaseId}`,
      `--output=${output}`,
    ],
    { cwd: webRoot, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(fs.readFileSync(output, 'utf8'));

  assert.equal(report.releaseId, manifest.releaseId);
  assert.deepEqual(report.counts, {
    units: 90,
    distinctConcepts: 698,
    conceptOccurrences: 892,
    authoredTeachingModels: 101,
    productionChecks: 303,
    adjudicatedTreatmentDecisions: 79,
    connectionCases: 11,
    taughtRelationships: 18,
    referenceOnlyRelationships: 21,
    nativeLabs: 5,
  });
  assert.equal(report.unitCoverage.length, 90);
  assert.equal(report.conceptCoverage.distinct.length, 698);
  assert.equal(report.conceptCoverage.occurrences.length, 892);
  assert.equal(report.assessmentCoverage.unit.rows.length, 270);
  assert.equal(report.assessmentCoverage.connection.rows.length, 33);
  assert.equal(report.treatmentCoverage.adjudicatedDecisions.length, 79);
  assert.equal(report.crossDomainCoverage.cases.length, 11);
  assert.equal(report.authoredTeachingCoverage.models, 101);
  const labSource = fs.readFileSync(
    path.join(webRoot, 'components/course-labs.tsx'),
    'utf8',
  );
  const declaredLabUnits = [
    ...labSource
      .slice(
        labSource.indexOf('export const hasLab'),
        labSource.indexOf('export function CourseLab'),
      )
      .matchAll(/'(d\d-[^']+)'/g),
  ]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(
    report.nativeLabs.implementations.map((lab) => lab.unitId).sort(),
    declaredLabUnits,
  );
  assert.equal(
    report.authoredTeachingCoverage.authoredStateInstances,
    report.authoredTeachingCoverage.baseStateInstances +
      report.authoredTeachingCoverage.variantStateInstances,
  );
  assert.ok(
    report.conceptCoverage.occurrences.every(
      (entry) =>
        entry.deepLink.endsWith(entry.conceptId) &&
        entry.explanation.definition &&
        entry.explanation.decision &&
        entry.explanation.failureExample &&
        entry.source.sourceRefIds.length,
    ),
  );
  assert.ok(
    report.treatmentCoverage.adjudicatedDecisions.every(
      (entry) =>
        entry.decisionRationale &&
        entry.productionDispositions.every(
          (disposition) => disposition.rationale && disposition.deepLink,
        ),
    ),
  );
  assert.ok(
    report.assessmentCoverage.unit.rows
      .concat(report.assessmentCoverage.connection.rows)
      .every((entry) =>
        entry.productionId.endsWith(
          `-${entry.authoredCheckSha256.slice(0, 12)}`,
        ),
      ),
  );
  if (
    report.reviewBinding.status ===
    'all_required_reviews_accepted_for_exact_release'
  )
    assert.ok(
      report.reviewBinding.selectedReviews.every(
        (review) => review.releaseAcceptance === 'accepted_for_exact_release',
      ),
    );
  for (const selected of report.reviewBinding.selectedReviews)
    if (selected.releaseAcceptance === 'accepted_for_exact_release') {
      assert.equal(selected.uncoveredModelIds.length, 0);
      assert.equal(selected.acceptedModelHashes, selected.requiredModelHashes);
      assert.ok(selected.currentReleaseReviewPaths.length > 0);
      assert.ok(selected.supportingReviewPaths.length > 0);
    }
});
