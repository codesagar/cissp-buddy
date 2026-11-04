import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateCourseConnections,
  validateCourseRelease,
} from '../lib/course/validate.ts';

const WEB_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const REPO_ROOT = path.dirname(WEB_ROOT);
const KNOWLEDGE_ROOT = path.join(REPO_ROOT, 'knowledge');
const TEACHING_ROOT = path.join(WEB_ROOT, 'lib/data/teaching');
const CONNECTION_ROOT = path.join(WEB_ROOT, 'lib/data/connections');
const OUTPUT_ROOT = path.join(WEB_ROOT, 'lib/data/course');
const UNIT_OUTPUT_ROOT = path.join(OUTPUT_ROOT, 'units');
const CONNECTION_OUTPUT_ROOT = path.join(OUTPUT_ROOT, 'connections');
// Fixed at the implementation window start so identical inputs reproduce the
// same immutable release instead of gaining a new timestamp on every build.
const PUBLISHED_AT = '2026-09-19T03:42:00.000Z';
const CHECK_ONLY = process.argv.includes('--check');

const walk = (directory) =>
  fs.existsSync(directory)
    ? fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) =>
          entry.isDirectory()
            ? walk(path.join(directory, entry.name))
            : [path.join(directory, entry.name)],
        )
    : [];

const jsonFiles = (directory, segment) =>
  walk(directory)
    .filter((file) => file.endsWith('.json') && file.includes(segment))
    .sort();

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
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
const stableJson = (value, pretty = false) =>
  `${JSON.stringify(stable(value), null, pretty ? 2 : undefined)}\n`;
const relativeToRepo = (file) =>
  path.relative(REPO_ROOT, file).split(path.sep).join('/');

const unitFiles = jsonFiles(path.join(KNOWLEDGE_ROOT, 'domains'), '/units/');
const visualFiles = jsonFiles(
  path.join(KNOWLEDGE_ROOT, 'domains'),
  '/visuals/',
);
const units = unitFiles.map((file) => ({ file, value: readJson(file) }));
const visuals = visualFiles.map((file) => ({ file, value: readJson(file) }));
const catalog = readJson(path.join(KNOWLEDGE_ROOT, 'catalog/concepts.json'));
const outline = readJson(
  path.join(KNOWLEDGE_ROOT, 'catalog/exam-outline.json'),
);
const relationshipCatalog = readJson(
  path.join(KNOWLEDGE_ROOT, 'catalog/cross-domain-connections.json'),
);

if (units.length !== 90)
  throw new Error(`Expected 90 canonical units; found ${units.length}.`);
if (visuals.length !== 179)
  throw new Error(`Expected 179 canonical visuals; found ${visuals.length}.`);

const conceptsById = new Map(
  catalog.concepts.map((concept) => [concept.id, concept]),
);
const unitsById = new Map(units.map((entry) => [entry.value.id, entry]));
const visualsByUnit = new Map();
for (const visual of visuals) {
  const list = visualsByUnit.get(visual.value.unitId) || [];
  list.push(visual);
  visualsByUnit.set(visual.value.unitId, list);
}

const allRowsByConcept = new Map();
for (const visual of visuals) {
  for (const node of visual.value.nodes || []) {
    for (const conceptId of node.conceptIds || []) {
      const rows = allRowsByConcept.get(conceptId) || [];
      rows.push({ visual, node });
      allRowsByConcept.set(conceptId, rows);
    }
  }
}

const teachingFiles = walk(TEACHING_ROOT)
  .filter((file) => file.endsWith('.json'))
  .sort();
const teachingByUnit = new Map();
for (const file of teachingFiles) {
  const model = readJson(file);
  if (!model.unitId || !unitsById.has(model.unitId))
    throw new Error(
      `Teaching model ${relativeToRepo(file)} has an unknown unitId.`,
    );
  if (teachingByUnit.has(model.unitId))
    throw new Error(`Duplicate teaching model for ${model.unitId}.`);
  teachingByUnit.set(model.unitId, { file, model });
}

const connectionSummaries = readJson(path.join(CONNECTION_ROOT, 'index.json'));
const referenceRelationships = readJson(
  path.join(CONNECTION_ROOT, 'reference-relationships.json'),
);
const connectionEntries = connectionSummaries.map((summary) => {
  const file = path.join(CONNECTION_ROOT, `${summary.id}.json`);
  if (!fs.existsSync(file))
    throw new Error(`Connection model ${summary.id} is missing.`);
  return { summary, file, model: readJson(file) };
});
if (connectionEntries.length !== 11 || referenceRelationships.length !== 21)
  throw new Error(
    `Expected 11 connection cases and 21 reference relationships; found ${connectionEntries.length} and ${referenceRelationships.length}.`,
  );

const hasTriple = ({ node }) =>
  Boolean(node.definition && node.decision && node.failureExample);
const hasDetail = ({ node }) => Boolean(node.detail || node.definition);
const chooseConceptRow = (unitId, conceptId) => {
  const local = (visualsByUnit.get(unitId) || []).flatMap((visual) =>
    (visual.value.nodes || [])
      .filter((node) => (node.conceptIds || []).includes(conceptId))
      .map((node) => ({ visual, node })),
  );
  const shared = allRowsByConcept.get(conceptId) || [];
  const selected =
    local.find(hasTriple) ||
    local.find(hasDetail) ||
    shared.find(hasTriple) ||
    shared.find(hasDetail);
  if (!selected)
    throw new Error(`${unitId}/${conceptId} has no canonical visual row.`);
  return {
    ...selected,
    bindingKind: local.includes(selected)
      ? 'unit-visual-row'
      : 'shared-visual-row',
    derivedFields: hasTriple(selected)
      ? []
      : ['definition', 'decision', 'failureExample'],
  };
};

const sourceRefsByUnitAndId = new Map();
for (const entry of units)
  for (const sourceRef of entry.value.sourceRefs || [])
    sourceRefsByUnitAndId.set(`${entry.value.id}::${sourceRef.id}`, sourceRef);

const conceptFromRow = (unitId, conceptId) => {
  const selected = chooseConceptRow(unitId, conceptId);
  const { visual, node, bindingKind, derivedFields } = selected;
  const rawDefinition = node.definition || node.detail;
  const rawDecision =
    node.decision ||
    `Use this point in the visual as a decision gate: ${node.detail}`;
  const rawFailureExample =
    node.failureExample ||
    `If this gate is skipped or applied to the wrong scope, the intended outcome can fail: ${node.detail}`;
  const catalogConcept = conceptsById.get(conceptId);
  if (!catalogConcept) throw new Error(`Unknown catalog concept ${conceptId}.`);
  const expand = (value, prefix) =>
    value.length >= 16 ? value : `${prefix}: ${value.replace(/[.]$/, '')}.`;
  const definition = expand(rawDefinition, `${catalogConcept.label} means`);
  const decision = expand(rawDecision, `${catalogConcept.label} decision`);
  const failureExample = expand(
    rawFailureExample,
    `${catalogConcept.label} failure example`,
  );
  const sourceRefIds = [...new Set(visual.value.sourceRefIds || [])].sort(
    (a, b) => a.localeCompare(b),
  );
  if (!definition || !decision || !failureExample || !sourceRefIds.length)
    throw new Error(`${unitId}/${conceptId} lacks substantive source mapping.`);
  return {
    concept: {
      id: conceptId,
      label: catalogConcept.label,
      definition,
      decision,
      failureExample,
      sourceVisualId: visual.value.id,
      sourceRefIds,
    },
    binding: {
      unitId,
      conceptId,
      sourceVisualId: visual.value.id,
      sourceVisualPath: relativeToRepo(visual.file),
      sourceVisualHash: sha256(fs.readFileSync(visual.file)),
      sourceRefIds,
      bindingKind,
      derivedFields,
    },
    sourceUnitId: visual.value.unitId,
  };
};

const domainShortNames = {
  1: 'Risk Management',
  2: 'Asset Security',
  3: 'Security Architecture',
  4: 'Network Security',
  5: 'IAM',
  6: 'Assessment',
  7: 'Security Operations',
  8: 'Software Security',
};
const domains = outline.domains.map((domain) => ({
  id: domain.id,
  name: domain.name,
  short: domainShortNames[domain.id],
  weight: domain.weight,
}));

const sourceBindings = [];
const assessmentBindings = [];
const withProductionAssessmentIds = (contentKind, contentId, entry) => {
  if (!entry) return null;
  const sourceTeachingPath = relativeToRepo(entry.file);
  const sourceTeachingHash = sha256(fs.readFileSync(entry.file));
  const model = structuredClone(entry.model);
  for (const phase of ['prediction', 'transfer', 'retry']) {
    const authoredCheck = entry.model[phase];
    if (!authoredCheck?.id)
      throw new Error(`${contentId}/${phase} has no authored assessment ID.`);
    const authoredCheckHash = sha256(stableJson(authoredCheck));
    const productionId = `${authoredCheck.id}-${authoredCheckHash.slice(0, 12)}`;
    model[phase].id = productionId;
    assessmentBindings.push({
      contentKind,
      contentId,
      ...(contentKind === 'unit'
        ? { unitId: contentId }
        : { connectionId: contentId }),
      phase,
      authoredId: authoredCheck.id,
      productionId,
      authoredCheckHash,
      sourceTeachingPath,
      sourceTeachingHash,
    });
  }
  return model;
};
const draftUnits = units
  .sort((a, b) => a.value.id.localeCompare(b.value.id))
  .map(({ file, value: unit }) => {
    const mapped = unit.conceptIds.map((conceptId) =>
      conceptFromRow(unit.id, conceptId),
    );
    sourceBindings.push(...mapped.map(({ binding }) => binding));
    const refs = new Map((unit.sourceRefs || []).map((ref) => [ref.id, ref]));
    for (const item of mapped) {
      const sourceUnit = unitsById.get(item.sourceUnitId)?.value;
      for (const sourceRefId of item.concept.sourceRefIds) {
        if (refs.has(sourceRefId)) continue;
        const sharedRef = sourceRefsByUnitAndId.get(
          `${sourceUnit?.id}::${sourceRefId}`,
        );
        if (!sharedRef)
          throw new Error(
            `${unit.id}/${item.concept.id} references missing source ${sourceRefId}.`,
          );
        refs.set(sourceRefId, sharedRef);
      }
    }
    const teachingEntry = teachingByUnit.get(unit.id);
    const teaching = withProductionAssessmentIds(
      'unit',
      unit.id,
      teachingEntry,
    );
    const unitVisuals = visualsByUnit.get(unit.id) || [];
    const unitSourceHash = sha256(
      stableJson({
        unit,
        visuals: unitVisuals.map(({ value }) => value),
        teaching,
      }),
    );
    return {
      id: unit.id,
      domainId: unit.domainId,
      objectiveIds: unit.objectiveIds,
      title: unit.title,
      summary: unit.summary,
      outcome: unit.outcome,
      conceptIds: unit.conceptIds,
      prerequisites: unit.prerequisites || [],
      estimatedMinutes: unit.estimatedMinutes,
      sections: unit.sections,
      workedExamples: (unit.workedExamples || []).map((example) => ({
        title: example.title,
        situation: example.situation,
        reasoning: example.reasoning,
        takeaway: example.takeaway || example.reasoning,
      })),
      misconceptions: (unit.misconceptions || []).map((item) => ({
        claim: item.claim || item.misconception,
        correction: item.correction,
      })),
      sourceRefs: [...refs.values()],
      concepts: mapped.map(({ concept }) => concept),
      teaching,
      sourcePath: relativeToRepo(file),
      sourceHash: unitSourceHash,
      releaseId: '',
    };
  });

const distinctConcepts = new Set(draftUnits.flatMap((unit) => unit.conceptIds));
const conceptOccurrences = draftUnits.reduce(
  (count, unit) => count + unit.conceptIds.length,
  0,
);
if (distinctConcepts.size !== 698 || conceptOccurrences !== 892)
  throw new Error(
    `Canonical coverage changed: ${distinctConcepts.size} concepts / ${conceptOccurrences} occurrences.`,
  );

const taughtRelationshipIds = connectionSummaries.flatMap(
  (summary) => summary.relationshipIds,
);
const referenceRelationshipIds = referenceRelationships.map(
  (relationship) => relationship.id,
);
const catalogRelationshipIds = new Set(
  relationshipCatalog.relationships.map((relationship) => relationship.id),
);
if (
  new Set(connectionSummaries.map((summary) => summary.id)).size !== 11 ||
  taughtRelationshipIds.length !== 18 ||
  new Set(taughtRelationshipIds).size !== 18 ||
  new Set(referenceRelationshipIds).size !== 21 ||
  catalogRelationshipIds.size !== 39 ||
  taughtRelationshipIds.some((id) => referenceRelationshipIds.includes(id)) ||
  [...taughtRelationshipIds, ...referenceRelationshipIds].some(
    (id) => !catalogRelationshipIds.has(id),
  )
)
  throw new Error('Connection relationship partition is invalid.');

const draftConnections = connectionEntries.map(({ summary, file, model }) => {
  if (model.unitId !== summary.id || model.title !== summary.title)
    throw new Error(`${summary.id} model identity differs from its index.`);
  const sourceUnits = summary.unitIds.map((unitId) => {
    const entry = unitsById.get(unitId);
    if (!entry)
      throw new Error(`${summary.id} references unknown unit ${unitId}.`);
    return entry.value;
  });
  const availableConcepts = new Set(
    sourceUnits.flatMap((unit) => unit.conceptIds),
  );
  const availableSourceRefs = new Set(
    sourceUnits.flatMap((unit) =>
      unit.sourceRefs.map((sourceRef) => sourceRef.id),
    ),
  );
  for (const node of model.nodes)
    for (const conceptId of node.conceptIds)
      if (!availableConcepts.has(conceptId))
        throw new Error(
          `${summary.id}/${node.id} references unavailable ${conceptId}.`,
        );
  for (const sourceRefId of model.sourceRefIds)
    if (!availableSourceRefs.has(sourceRefId))
      throw new Error(`${summary.id} references unavailable ${sourceRefId}.`);
  return {
    ...summary,
    model: withProductionAssessmentIds('connection', summary.id, {
      file,
      model,
    }),
  };
});

const releaseSourceHash = sha256(
  stableJson({
    schemaVersion: 2,
    publishedAt: PUBLISHED_AT,
    domains,
    units: draftUnits,
    sourceBindings,
    assessmentBindings,
    connections: draftConnections,
    referenceRelationships,
  }),
);
const releaseId = `cissp-course-2026-09-${releaseSourceHash.slice(0, 16)}`;
const courseUnits = draftUnits.map((unit) => ({ ...unit, releaseId }));
const courseConnections = draftConnections.map((connection) => ({
  releaseId,
  ...connection,
}));
const connectionsIndex = {
  releaseId,
  cases: connectionSummaries,
  referenceRelationships,
};
const manifest = {
  releaseId,
  sourceHash: releaseSourceHash,
  publishedAt: PUBLISHED_AT,
  domains,
  units: courseUnits.map((unit) => ({
    id: unit.id,
    domainId: unit.domainId,
    objectiveIds: unit.objectiveIds,
    title: unit.title,
    summary: unit.summary,
    outcome: unit.outcome,
    conceptIds: unit.conceptIds,
    conceptLabels: unit.concepts.map((concept) => concept.label),
    estimatedMinutes: unit.estimatedMinutes,
    teachingReady: unit.teaching !== null,
    prerequisites: unit.prerequisites,
    checks: unit.teaching
      ? [
          unit.teaching.prediction,
          unit.teaching.transfer,
          unit.teaching.retry,
        ].map(({ id, conceptIds }) => ({ id, conceptIds }))
      : [],
  })),
  counts: {
    units: courseUnits.length,
    concepts: distinctConcepts.size,
    conceptOccurrences,
    teachingModels: courseUnits.filter((unit) => unit.teaching).length,
    assessments: courseUnits.filter((unit) => unit.teaching).length * 3,
  },
};

// Authoring is held to the current semantic contract before any generated
// bytes are written. Repository reads intentionally use the validator's
// structural-compatible default so older sealed releases remain readable.
validateCourseRelease(manifest, courseUnits, true);
validateCourseConnections(
  connectionsIndex,
  courseConnections,
  courseUnits,
  true,
);

if (!CHECK_ONLY) {
  fs.mkdirSync(UNIT_OUTPUT_ROOT, { recursive: true });
  fs.mkdirSync(CONNECTION_OUTPUT_ROOT, { recursive: true });
}
const expectedUnitFiles = new Set(courseUnits.map((unit) => `${unit.id}.json`));
const existingUnitFiles = fs.existsSync(UNIT_OUTPUT_ROOT)
  ? fs.readdirSync(UNIT_OUTPUT_ROOT)
  : [];
const staleFiles = existingUnitFiles.filter(
  (file) => file.endsWith('.json') && !expectedUnitFiles.has(file),
);
if (CHECK_ONLY && staleFiles.length)
  throw new Error(`Stale generated unit files: ${staleFiles.join(', ')}`);
for (const file of staleFiles)
  if (file.endsWith('.json') && !expectedUnitFiles.has(file))
    fs.rmSync(path.join(UNIT_OUTPUT_ROOT, file));
const expectedConnectionFiles = new Set(
  courseConnections.map((connection) => `${connection.id}.json`),
);
const staleConnectionFiles = fs.existsSync(CONNECTION_OUTPUT_ROOT)
  ? fs
      .readdirSync(CONNECTION_OUTPUT_ROOT)
      .filter(
        (file) => file.endsWith('.json') && !expectedConnectionFiles.has(file),
      )
  : [];
if (CHECK_ONLY && staleConnectionFiles.length)
  throw new Error(
    `Stale generated connection files: ${staleConnectionFiles.join(', ')}`,
  );
for (const file of staleConnectionFiles)
  fs.rmSync(path.join(CONNECTION_OUTPUT_ROOT, file));
const emit = (file, content) => {
  if (CHECK_ONLY) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content)
      throw new Error(
        `Generated course is stale at ${relativeToRepo(file)}; run npm run course:generate.`,
      );
    return;
  }
  fs.writeFileSync(file, content);
};
for (const unit of courseUnits)
  emit(path.join(UNIT_OUTPUT_ROOT, `${unit.id}.json`), stableJson(unit, true));
for (const connection of courseConnections)
  emit(
    path.join(CONNECTION_OUTPUT_ROOT, `${connection.id}.json`),
    stableJson(connection, true),
  );
emit(path.join(OUTPUT_ROOT, 'manifest.json'), stableJson(manifest, true));
emit(
  path.join(OUTPUT_ROOT, 'connections-index.json'),
  stableJson(connectionsIndex, true),
);
emit(
  path.join(OUTPUT_ROOT, 'source-bindings.json'),
  stableJson(
    {
      releaseId,
      sourceHash: releaseSourceHash,
      occurrences: sourceBindings,
      assessments: assessmentBindings,
    },
    true,
  ),
);

const importLines = courseUnits.map(
  (unit, index) =>
    `import unit${index} from './units/${unit.id}.json' with { type: 'json' };`,
);
const connectionImportLines = courseConnections.map(
  (connection, index) =>
    `import connection${index} from './connections/${connection.id}.json' with { type: 'json' };`,
);
const releaseModule = `${importLines.join('\n')}
${connectionImportLines.join('\n')}
import manifest from './manifest.json' with { type: 'json' };
import connectionsIndex from './connections-index.json' with { type: 'json' };
import sourceBindings from './source-bindings.json' with { type: 'json' };
import type { CourseConnection, CourseConnectionsIndex, CourseManifest, CourseUnit } from '../../course/types';

export const generatedCourseManifest = manifest as CourseManifest;
export const generatedCourseUnits = [${courseUnits.map((_, index) => `unit${index}`).join(', ')}] as CourseUnit[];
export const generatedCourseConnectionsIndex = connectionsIndex as CourseConnectionsIndex;
export const generatedCourseConnections = [${courseConnections.map((_, index) => `connection${index}`).join(', ')}] as CourseConnection[];
export const generatedCourseSourceBindings = sourceBindings;
`;
emit(path.join(OUTPUT_ROOT, 'release.ts'), releaseModule);

console.log(
  JSON.stringify(
    {
      releaseId,
      sourceHash: releaseSourceHash,
      units: courseUnits.length,
      concepts: distinctConcepts.size,
      conceptOccurrences,
      teachingModels: manifest.counts.teachingModels,
      connections: courseConnections.length,
      referenceRelationships: referenceRelationships.length,
      assessments: assessmentBindings.length,
      sourceBindings: sourceBindings.length,
    },
    null,
    2,
  ),
);
