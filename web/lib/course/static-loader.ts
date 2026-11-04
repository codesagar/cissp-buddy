import type {
  TeachingCheck,
  CourseManifest,
  CourseUnit,
  CourseConnection,
  CourseConnectionsIndex,
} from './types';
import type { Curriculum } from '../curriculum';
import { validateCourseUnit, validateTeaching } from './validate.ts';
import { validateRelease } from '../content/validate.ts';
export const PILOT_RELEASE_ID = 'cissp-foundations-2026-09-06-r2';
const base = import.meta.env?.BASE_URL ?? '/';
export const appUrl = (path = '') => `${base}${path.replace(/^\/+/, '')}`;
export const contentUrl = (path: string) =>
  appUrl(`content/${path.replace(/^\/+/, '')}`);
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const safeId = (id: string) => {
  if (!/^[a-z0-9][a-z0-9-]{0,149}$/.test(id))
    throw Error('Invalid content identity.');
  return id;
};
async function json(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(contentUrl(path), { signal });
  if (!response.ok)
    throw Error(
      response.status === 404
        ? 'That content release is unavailable. Reload the course outline to check for an update.'
        : 'The content could not load. Check your connection and try again.',
    );
  try {
    return await response.json();
  } catch {
    throw Error(
      'The content response is damaged. Try again or reload the course outline.',
    );
  }
}
export function validateManifest(value: unknown): CourseManifest {
  if (
    !object(value) ||
    typeof value.releaseId !== 'string' ||
    typeof value.sourceHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.sourceHash) ||
    !value.releaseId.endsWith(value.sourceHash.slice(0, 16)) ||
    typeof value.publishedAt !== 'string' ||
    Number.isNaN(Date.parse(value.publishedAt)) ||
    !Array.isArray(value.domains) ||
    value.domains.length !== 8 ||
    !Array.isArray(value.units) ||
    value.units.length !== 90 ||
    !object(value.counts)
  )
    throw Error('The course outline is invalid.');
  safeId(value.releaseId);
  const domainIds = new Set<number>();
  for (const domain of value.domains) {
    if (
      !object(domain) ||
      typeof domain.id !== 'number' ||
      !Number.isInteger(domain.id) ||
      domain.id < 1 ||
      domain.id > 8 ||
      typeof domain.name !== 'string' ||
      !domain.name ||
      typeof domain.short !== 'string' ||
      !domain.short ||
      typeof domain.weight !== 'number' ||
      domain.weight <= 0 ||
      domainIds.has(domain.id)
    )
      throw Error('The course outline has invalid domains.');
    domainIds.add(domain.id);
  }
  const ids = new Set<string>(),
    checkIds = new Set<string>(),
    concepts = new Set<string>();
  let occurrences = 0,
    teachingModels = 0,
    assessments = 0;
  for (const summary of value.units) {
    if (
      !object(summary) ||
      typeof summary.id !== 'string' ||
      typeof summary.title !== 'string' ||
      !summary.title ||
      typeof summary.summary !== 'string' ||
      !summary.summary ||
      typeof summary.outcome !== 'string' ||
      !summary.outcome ||
      typeof summary.domainId !== 'number' ||
      !domainIds.has(summary.domainId) ||
      !strings(summary.objectiveIds) ||
      !strings(summary.conceptIds) ||
      !strings(summary.conceptLabels) ||
      summary.conceptLabels.length !== summary.conceptIds.length ||
      !strings(summary.prerequisites) ||
      typeof summary.estimatedMinutes !== 'number' ||
      !Number.isInteger(summary.estimatedMinutes) ||
      summary.estimatedMinutes < 1 ||
      typeof summary.teachingReady !== 'boolean' ||
      !Array.isArray(summary.checks) ||
      summary.checks.length !== (summary.teachingReady ? 3 : 0)
    )
      throw Error('The course outline has invalid lesson metadata.');
    safeId(summary.id);
    if (
      ids.has(summary.id) ||
      new Set(summary.conceptIds).size !== summary.conceptIds.length
    )
      throw Error(
        'The course outline has duplicate lesson or concept identities.',
      );
    for (const check of summary.checks) {
      if (
        !object(check) ||
        typeof check.id !== 'string' ||
        !/-[a-f0-9]{12}$/.test(check.id) ||
        checkIds.has(check.id) ||
        !strings(check.conceptIds) ||
        !check.conceptIds.length ||
        new Set(check.conceptIds).size !== check.conceptIds.length ||
        check.conceptIds.some(
          (id) => !(summary.conceptIds as string[]).includes(id),
        )
      )
        throw Error('The course outline has invalid question scope.');
      checkIds.add(check.id);
    }
    ids.add(summary.id);
    summary.conceptIds.forEach((id) => concepts.add(id));
    occurrences += summary.conceptIds.length;
    teachingModels += summary.teachingReady ? 1 : 0;
    assessments += summary.checks.length;
  }
  const expected = {
    units: ids.size,
    concepts: concepts.size,
    conceptOccurrences: occurrences,
    teachingModels,
    assessments,
  };
  if (
    concepts.size !== 698 ||
    occurrences !== 892 ||
    Object.entries(expected).some(
      ([key, count]) =>
        (value.counts as Record<string, unknown>)[key] !== count,
    )
  )
    throw Error('The course outline has inconsistent coverage counts.');
  for (const summary of value.units)
    if (
      summary.prerequisites.some(
        (id: string) => !ids.has(id) && !concepts.has(id),
      )
    )
      throw Error('The course outline has an unknown prerequisite.');
  return value as unknown as CourseManifest;
}
// The ID suffix binds the full authored check, including feedback and answer semantics.
const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : object(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])]),
        )
      : value;
async function validateCheckIdentity(check: TeachingCheck) {
  if (
    !check ||
    typeof check.id !== 'string' ||
    !/-[a-f0-9]{12}$/.test(check.id)
  )
    throw Error('The question identity is invalid.');
  const authored = { ...check, id: check.id.slice(0, -13) };
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${JSON.stringify(stable(authored))}\n`),
  );
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  if (!check.id.endsWith(`-${hash.slice(0, 12)}`))
    throw Error(
      'The question content has changed under its saved identity. Reload the course outline.',
    );
}
export async function loadManifest(signal?: AbortSignal) {
  return validateManifest(await json('course/manifest.json', signal));
}
const releasePath = (manifest: CourseManifest) =>
  `course/${safeId(manifest.releaseId)}`;
export async function loadUnit(
  manifest: CourseManifest,
  id: string,
  signal?: AbortSignal,
): Promise<CourseUnit> {
  const summary = manifest.units.find((unit) => unit.id === id);
  if (!summary) throw Error('That lesson is not in this course outline.');
  const value = await json(
    `${releasePath(manifest)}/units/${safeId(id)}.json`,
    signal,
  );
  if (
    !object(value) ||
    value.id !== id ||
    value.releaseId !== manifest.releaseId ||
    value.title !== summary.title ||
    value.domainId !== summary.domainId ||
    JSON.stringify(value.conceptIds) !== JSON.stringify(summary.conceptIds) ||
    JSON.stringify(value.prerequisites) !==
      JSON.stringify(summary.prerequisites)
  )
    throw Error(
      'The lesson does not match the loaded course release. Reload the course outline.',
    );
  const unit = validateCourseUnit(value as unknown as CourseUnit);
  const checks = unit.teaching
    ? [
        unit.teaching.prediction,
        unit.teaching.transfer,
        unit.teaching.retry,
      ].map(({ id, conceptIds }) => ({ id, conceptIds }))
    : [];
  if (
    JSON.stringify(checks.map(({ id, conceptIds }) => [id, conceptIds])) !==
    JSON.stringify(
      summary.checks?.map(({ id, conceptIds }) => [id, conceptIds]),
    )
  )
    throw Error('The lesson questions do not match the loaded course release.');
  if (unit.teaching)
    await Promise.all(
      [
        unit.teaching.prediction,
        unit.teaching.transfer,
        unit.teaching.retry,
      ].map(validateCheckIdentity),
    );
  return unit;
}
export async function loadConnectionsIndex(
  manifest: CourseManifest,
  signal?: AbortSignal,
): Promise<CourseConnectionsIndex> {
  const value = await json(
    `${releasePath(manifest)}/connections-index.json`,
    signal,
  );
  if (
    !object(value) ||
    value.releaseId !== manifest.releaseId ||
    !Array.isArray(value.cases) ||
    value.cases.length !== 11 ||
    !Array.isArray(value.referenceRelationships) ||
    value.referenceRelationships.length !== 21 ||
    value.cases.some(
      (item) =>
        !object(item) ||
        typeof item.id !== 'string' ||
        typeof item.title !== 'string' ||
        !strings(item.unitIds) ||
        !strings(item.relationshipIds),
    ) ||
    new Set(value.cases.map((item) => item.id)).size !== value.cases.length
  )
    throw Error('The connections do not match the loaded course release.');
  const index = value as unknown as CourseConnectionsIndex;
  const unitIds = new Set(manifest.units.map((unit) => unit.id));
  const taught = index.cases.flatMap((item) => item.relationshipIds);
  const referenced = new Set<string>();
  for (const summary of index.cases) {
    safeId(summary.id);
    if (
      !summary.title ||
      !summary.unitIds.length ||
      summary.unitIds.some((id) => !unitIds.has(id))
    )
      throw Error('The connections reference an unavailable lesson.');
  }
  for (const relationship of value.referenceRelationships) {
    if (
      !object(relationship) ||
      typeof relationship.id !== 'string' ||
      !relationship.id ||
      referenced.has(relationship.id) ||
      typeof relationship.fromObjectiveId !== 'string' ||
      !relationship.fromObjectiveId ||
      typeof relationship.toObjectiveId !== 'string' ||
      !relationship.toObjectiveId ||
      typeof relationship.kind !== 'string' ||
      !relationship.kind ||
      relationship.directionality !== 'directed' ||
      typeof relationship.rationale !== 'string' ||
      !relationship.rationale ||
      typeof relationship.storyboardId !== 'string' ||
      !relationship.storyboardId ||
      typeof relationship.reason !== 'string' ||
      !relationship.reason ||
      !object(relationship.sourceSupport) ||
      typeof relationship.sourceSupport.note !== 'string' ||
      !relationship.sourceSupport.note ||
      !strings(relationship.sourceSupport.sourceIds) ||
      !relationship.sourceSupport.sourceIds.length
    )
      throw Error('The connection reference details are invalid.');
    referenced.add(relationship.id);
  }
  if (
    taught.length !== 18 ||
    new Set(taught).size !== 18 ||
    taught.some((id) => referenced.has(id))
  )
    throw Error('The connection relationship scope is invalid.');
  return index;
}
export async function loadConnection(
  manifest: CourseManifest,
  id: string,
  signal?: AbortSignal,
): Promise<CourseConnection> {
  const value = await json(
    `${releasePath(manifest)}/connections/${safeId(id)}.json`,
    signal,
  );
  if (
    !object(value) ||
    value.id !== id ||
    value.releaseId !== manifest.releaseId ||
    typeof value.title !== 'string' ||
    !strings(value.unitIds) ||
    !strings(value.relationshipIds) ||
    !object(value.model) ||
    value.model.unitId !== id ||
    !Array.isArray(value.model.nodes) ||
    !Array.isArray(value.model.states) ||
    !Array.isArray(value.model.variants) ||
    !object(value.model.prediction) ||
    !object(value.model.transfer) ||
    !object(value.model.retry)
  )
    throw Error('The linked case does not match the loaded course release.');
  const connection = value as unknown as CourseConnection;
  const sourceUnits = connection.unitIds.map((unitId) =>
    manifest.units.find((unit) => unit.id === unitId),
  );
  if (
    !connection.unitIds.length ||
    sourceUnits.some((unit) => !unit) ||
    !strings(value.model.sourceRefIds)
  )
    throw Error('The linked case references unavailable source material.');
  try {
    validateTeaching(connection.model, {
      id,
      conceptIds: [...new Set(sourceUnits.flatMap((unit) => unit!.conceptIds))],
      sourceRefs: value.model.sourceRefIds.map((id) => ({ id })),
    });
  } catch {
    throw Error(
      'The linked case content is damaged. Try again or reload the course outline.',
    );
  }

  await Promise.all(
    [
      connection.model.prediction,
      connection.model.transfer,
      connection.model.retry,
    ].map(validateCheckIdentity),
  );
  return connection;
}
export async function loadPilot(signal?: AbortSignal): Promise<Curriculum> {
  const value = await json(`pilot/${PILOT_RELEASE_ID}.json`, signal);
  if (!object(value) || value.releaseId !== PILOT_RELEASE_ID)
    throw Error('The original pilot release is unavailable.');
  const pack = value as unknown as Curriculum;
  validateRelease(pack);
  return pack;
}
