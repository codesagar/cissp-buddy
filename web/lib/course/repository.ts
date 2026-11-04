import { getContentDatabase } from '../content/database';
import {
  generatedCourseConnections,
  generatedCourseConnectionsIndex,
  generatedCourseManifest,
  generatedCourseSourceBindings,
  generatedCourseUnits,
} from '../data/course/release';
import type {
  CourseConnection,
  CourseConnectionsIndex,
  CourseManifest,
  CourseUnit,
  ReferenceRelationship,
} from './types';
import { validateCourseConnections, validateCourseRelease } from './validate';

const manifest = validateCourseRelease(
  generatedCourseManifest,
  generatedCourseUnits,
);
const connectionsIndex = validateCourseConnections(
  generatedCourseConnectionsIndex,
  generatedCourseConnections,
  generatedCourseUnits,
);
const installedReleases = new WeakMap<object, Set<string>>();
const SEED_BATCH_SIZE = 50;

type SourceBinding = (typeof generatedCourseSourceBindings.occurrences)[number];

export class CourseReleaseNotFoundError extends Error {
  constructor(readonly releaseId: string) {
    super(`Course release ${releaseId} is unavailable.`);
  }
}

export class CourseUnitNotFoundError extends Error {
  constructor(
    readonly unitId: string,
    readonly releaseId: string,
  ) {
    super(`Course unit ${unitId} is unavailable in ${releaseId}.`);
  }
}

export class CourseConnectionsNotFoundError extends Error {
  constructor(readonly releaseId: string) {
    super(`Course connections are unavailable in ${releaseId}.`);
  }
}

export class CourseConnectionNotFoundError extends Error {
  constructor(
    readonly connectionId: string,
    readonly releaseId: string,
  ) {
    super(`Course connection ${connectionId} is unavailable in ${releaseId}.`);
  }
}

const chunks = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    result.push(items.slice(index, index + size));
  return result;
};

const verifyReleaseIdentity = (
  row: { source_hash: string; manifest_json: string },
  expected: CourseManifest,
) => {
  if (
    row.source_hash !== expected.sourceHash ||
    row.manifest_json !== JSON.stringify(expected)
  )
    throw new Error(
      `Immutable course release ${expected.releaseId} differs from generated content.`,
    );
};

const verifyCompleteRelease = async (db: D1Database) => {
  const counts = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM course_units WHERE release_id = ?) AS units,
        (SELECT COUNT(*) FROM course_source_bindings WHERE release_id = ?) AS bindings,
        (SELECT COUNT(*) FROM course_connections WHERE release_id = ?) AS connections,
        (SELECT COUNT(*) FROM course_reference_relationships WHERE release_id = ?) AS reference_relationships`,
    )
    .bind(
      manifest.releaseId,
      manifest.releaseId,
      manifest.releaseId,
      manifest.releaseId,
    )
    .first<{
      units: number;
      bindings: number;
      connections: number;
      reference_relationships: number;
    }>();
  if (
    !counts ||
    counts.units !== manifest.counts.units ||
    counts.bindings !== manifest.counts.conceptOccurrences ||
    counts.connections !== connectionsIndex.cases.length ||
    counts.reference_relationships !==
      connectionsIndex.referenceRelationships.length
  )
    throw new Error('Course release seed did not reach complete coverage.');
};

/**
 * Installs the generated content-hash release without updating existing bytes.
 * A partially interrupted install is safe to resume; the release is visible to
 * readers only after every unit and source binding has been verified and sealed.
 */
export async function ensureCourseRelease(
  db: D1Database = getContentDatabase(),
): Promise<void> {
  const cacheKey = db as unknown as object;
  const cached = installedReleases.get(cacheKey);
  if (cached?.has(manifest.releaseId)) return;

  let release = await db
    .prepare(
      'SELECT source_hash,manifest_json,sealed FROM course_releases WHERE id = ?',
    )
    .bind(manifest.releaseId)
    .first<{
      source_hash: string;
      manifest_json: string;
      sealed: number;
    }>();
  if (release) {
    verifyReleaseIdentity(release, manifest);
    if (release.sealed === 1) {
      await verifyCompleteRelease(db);
      const next = cached || new Set<string>();
      next.add(manifest.releaseId);
      installedReleases.set(cacheKey, next);
      return;
    }
  } else {
    await db
      .prepare(
        `INSERT INTO course_releases(
          id,source_hash,published_at,manifest_json,unit_count,concept_count,
          concept_occurrence_count,teaching_model_count,assessment_count,sealed
        ) VALUES(?,?,?,?,?,?,?,?,?,0) ON CONFLICT(id) DO NOTHING`,
      )
      .bind(
        manifest.releaseId,
        manifest.sourceHash,
        manifest.publishedAt,
        JSON.stringify(manifest),
        manifest.counts.units,
        manifest.counts.concepts,
        manifest.counts.conceptOccurrences,
        manifest.counts.teachingModels,
        manifest.counts.assessments,
      )
      .run();
    release = await db
      .prepare(
        'SELECT source_hash,manifest_json,sealed FROM course_releases WHERE id = ?',
      )
      .bind(manifest.releaseId)
      .first<{
        source_hash: string;
        manifest_json: string;
        sealed: number;
      }>();
    if (!release) throw new Error('Course release seed could not be started.');
    verifyReleaseIdentity(release, manifest);
  }

  const existingUnits = await db
    .prepare(
      'SELECT unit_id,source_hash,payload_json FROM course_units WHERE release_id = ?',
    )
    .bind(manifest.releaseId)
    .all<{ unit_id: string; source_hash: string; payload_json: string }>();
  const storedUnits = new Map(
    existingUnits.results.map((row) => [row.unit_id, row]),
  );
  for (const unit of generatedCourseUnits) {
    const stored = storedUnits.get(unit.id);
    if (
      stored &&
      (stored.source_hash !== unit.sourceHash ||
        stored.payload_json !== JSON.stringify(unit))
    )
      throw new Error(
        `Immutable course unit ${manifest.releaseId}/${unit.id} differs from generated content.`,
      );
  }
  const missingUnits = generatedCourseUnits.filter(
    (unit) => !storedUnits.has(unit.id),
  );
  const sortOrders = new Map(
    manifest.units.map((unit, index) => [unit.id, index]),
  );
  for (const batch of chunks(missingUnits, SEED_BATCH_SIZE))
    await db.batch(
      batch.map((unit) =>
        db
          .prepare(
            `INSERT INTO course_units(
              release_id,unit_id,domain_id,sort_order,source_hash,payload_json
            ) VALUES(?,?,?,?,?,?) ON CONFLICT(release_id,unit_id) DO NOTHING`,
          )
          .bind(
            manifest.releaseId,
            unit.id,
            unit.domainId,
            sortOrders.get(unit.id),
            unit.sourceHash,
            JSON.stringify(unit),
          ),
      ),
    );

  const existingBindings = await db
    .prepare(
      `SELECT unit_id,concept_id,payload_json FROM course_source_bindings
       WHERE release_id = ?`,
    )
    .bind(manifest.releaseId)
    .all<{ unit_id: string; concept_id: string; payload_json: string }>();
  const storedBindings = new Map(
    existingBindings.results.map((row) => [
      `${row.unit_id}::${row.concept_id}`,
      row.payload_json,
    ]),
  );
  for (const binding of generatedCourseSourceBindings.occurrences) {
    const key = `${binding.unitId}::${binding.conceptId}`;
    const stored = storedBindings.get(key);
    if (stored && stored !== JSON.stringify(binding))
      throw new Error(
        `Immutable source binding ${manifest.releaseId}/${key} differs from generated content.`,
      );
  }
  const missingBindings = generatedCourseSourceBindings.occurrences.filter(
    (binding) => !storedBindings.has(`${binding.unitId}::${binding.conceptId}`),
  );
  for (const batch of chunks<SourceBinding>(missingBindings, SEED_BATCH_SIZE))
    await db.batch(
      batch.map((binding) =>
        db
          .prepare(
            `INSERT INTO course_source_bindings(
              release_id,unit_id,concept_id,source_visual_id,payload_json
            ) VALUES(?,?,?,?,?)
            ON CONFLICT(release_id,unit_id,concept_id) DO NOTHING`,
          )
          .bind(
            manifest.releaseId,
            binding.unitId,
            binding.conceptId,
            binding.sourceVisualId,
            JSON.stringify(binding),
          ),
      ),
    );

  const existingConnections = await db
    .prepare(
      `SELECT connection_id,payload_json FROM course_connections
       WHERE release_id = ?`,
    )
    .bind(manifest.releaseId)
    .all<{ connection_id: string; payload_json: string }>();
  const storedConnections = new Map(
    existingConnections.results.map((row) => [
      row.connection_id,
      row.payload_json,
    ]),
  );
  for (const connection of generatedCourseConnections) {
    const stored = storedConnections.get(connection.id);
    if (stored && stored !== JSON.stringify(connection))
      throw new Error(
        `Immutable course connection ${manifest.releaseId}/${connection.id} differs from generated content.`,
      );
  }
  const connectionSortOrders = new Map(
    connectionsIndex.cases.map((item, index) => [item.id, index]),
  );
  const missingConnections = generatedCourseConnections.filter(
    (connection) => !storedConnections.has(connection.id),
  );
  for (const batch of chunks(missingConnections, SEED_BATCH_SIZE))
    await db.batch(
      batch.map((connection) =>
        db
          .prepare(
            `INSERT INTO course_connections(
              release_id,connection_id,sort_order,payload_json
            ) VALUES(?,?,?,?)
            ON CONFLICT(release_id,connection_id) DO NOTHING`,
          )
          .bind(
            manifest.releaseId,
            connection.id,
            connectionSortOrders.get(connection.id),
            JSON.stringify(connection),
          ),
      ),
    );

  const existingReferences = await db
    .prepare(
      `SELECT relationship_id,payload_json FROM course_reference_relationships
       WHERE release_id = ?`,
    )
    .bind(manifest.releaseId)
    .all<{ relationship_id: string; payload_json: string }>();
  const storedReferences = new Map(
    existingReferences.results.map((row) => [
      row.relationship_id,
      row.payload_json,
    ]),
  );
  for (const relationship of connectionsIndex.referenceRelationships) {
    const stored = storedReferences.get(relationship.id);
    if (stored && stored !== JSON.stringify(relationship))
      throw new Error(
        `Immutable reference relationship ${manifest.releaseId}/${relationship.id} differs from generated content.`,
      );
  }
  const missingReferences = connectionsIndex.referenceRelationships.filter(
    (relationship) => !storedReferences.has(relationship.id),
  );
  for (const batch of chunks(missingReferences, SEED_BATCH_SIZE))
    await db.batch(
      batch.map((relationship) =>
        db
          .prepare(
            `INSERT INTO course_reference_relationships(
              release_id,relationship_id,sort_order,payload_json
            ) VALUES(?,?,?,?)
            ON CONFLICT(release_id,relationship_id) DO NOTHING`,
          )
          .bind(
            manifest.releaseId,
            relationship.id,
            connectionsIndex.referenceRelationships.findIndex(
              (item) => item.id === relationship.id,
            ),
            JSON.stringify(relationship),
          ),
      ),
    );

  await verifyCompleteRelease(db);

  await db
    .prepare(
      'UPDATE course_releases SET sealed = 1 WHERE id = ? AND sealed = 0',
    )
    .bind(manifest.releaseId)
    .run();
  const next = cached || new Set<string>();
  next.add(manifest.releaseId);
  installedReleases.set(cacheKey, next);
}

export async function readCourseManifest(
  releaseId = manifest.releaseId,
  db: D1Database = getContentDatabase(),
): Promise<CourseManifest> {
  await ensureCourseRelease(db);
  const row = await db
    .prepare(
      'SELECT manifest_json FROM course_releases WHERE id = ? AND sealed = 1',
    )
    .bind(releaseId)
    .first<{ manifest_json: string }>();
  if (!row) throw new CourseReleaseNotFoundError(releaseId);
  return JSON.parse(row.manifest_json) as CourseManifest;
}

export async function readCourseUnit(
  unitId: string,
  releaseId = manifest.releaseId,
  db: D1Database = getContentDatabase(),
): Promise<CourseUnit> {
  await readCourseManifest(releaseId, db);
  const row = await db
    .prepare(
      `SELECT payload_json FROM course_units
       WHERE release_id = ? AND unit_id = ?`,
    )
    .bind(releaseId, unitId)
    .first<{ payload_json: string }>();
  if (!row) throw new CourseUnitNotFoundError(unitId, releaseId);
  return JSON.parse(row.payload_json) as CourseUnit;
}

export async function readCourseSourceBindings(
  unitId: string,
  releaseId = manifest.releaseId,
  db: D1Database = getContentDatabase(),
): Promise<SourceBinding[]> {
  await readCourseManifest(releaseId, db);
  const rows = await db
    .prepare(
      `SELECT payload_json FROM course_source_bindings
       WHERE release_id = ? AND unit_id = ? ORDER BY concept_id`,
    )
    .bind(releaseId, unitId)
    .all<{ payload_json: string }>();
  return rows.results.map(
    (row) => JSON.parse(row.payload_json) as SourceBinding,
  );
}

export async function readCourseConnectionsIndex(
  releaseId = manifest.releaseId,
  db: D1Database = getContentDatabase(),
): Promise<CourseConnectionsIndex> {
  await readCourseManifest(releaseId, db);
  const [connections, references] = await Promise.all([
    db
      .prepare(
        `SELECT payload_json FROM course_connections
         WHERE release_id = ? ORDER BY sort_order`,
      )
      .bind(releaseId)
      .all<{ payload_json: string }>(),
    db
      .prepare(
        `SELECT payload_json FROM course_reference_relationships
         WHERE release_id = ? ORDER BY sort_order`,
      )
      .bind(releaseId)
      .all<{ payload_json: string }>(),
  ]);
  if (connections.results.length !== 11 || references.results.length !== 21)
    throw new CourseConnectionsNotFoundError(releaseId);
  return {
    releaseId,
    cases: connections.results.map((row) => {
      const { id, title, unitIds, relationshipIds } = JSON.parse(
        row.payload_json,
      ) as CourseConnection;
      return { id, title, unitIds, relationshipIds };
    }),
    referenceRelationships: references.results.map(
      (row) => JSON.parse(row.payload_json) as ReferenceRelationship,
    ),
  };
}

export async function readCourseConnection(
  connectionId: string,
  releaseId = manifest.releaseId,
  db: D1Database = getContentDatabase(),
): Promise<CourseConnection> {
  await readCourseConnectionsIndex(releaseId, db);
  const row = await db
    .prepare(
      `SELECT payload_json FROM course_connections
       WHERE release_id = ? AND connection_id = ?`,
    )
    .bind(releaseId, connectionId)
    .first<{ payload_json: string }>();
  if (!row) throw new CourseConnectionNotFoundError(connectionId, releaseId);
  return JSON.parse(row.payload_json) as CourseConnection;
}

export const currentCourseReleaseId = manifest.releaseId;
