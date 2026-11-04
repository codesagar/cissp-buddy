import {
  collection,
  doc,
  documentId,
  deleteField,
  FieldPath,
  getDocFromServer,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  writeBatch,
} from 'firebase/firestore';
import type {
  DocumentData,
  DocumentReference,
  Firestore,
  QueryDocumentSnapshot,
  WriteBatch,
} from 'firebase/firestore';
import { validateLearnerState } from '../course/learner-state.ts';
import type { LearnerState } from '../course/learner-state';
import type { StudyState } from '../study-state';
import {
  assembleCourseState,
  assemblePilotState,
  assertCourseAnswersPreserved,
  assertPilotAnswersPreserved,
  splitCourseState,
  splitPilotState,
} from './records.ts';
import type { CourseRecords, PilotRecords } from './records';

export type Dataset = 'course' | 'pilot';
type Validator<T> = (value: unknown) => T;
type JsonRecord = Record<string, unknown>;
type Row = { collection: string; id: string; value: JsonRecord };
type StoredRow = { key: string; value: JsonRecord };
type Envelope = {
  schemaVersion: 1;
  initialized: true;
  revision: string;
  metadata: JsonRecord;
};
type ImportMarker = {
  schemaVersion: 1;
  status: 'importing' | 'ready';
  digest: string;
  counts: Record<string, number>;
};
const PAGE_SIZE = 200;
const MAX_NORMAL_BATCH_WRITES = 450;
const MAX_IMPORT_BATCH_WRITES = 150;
const MAX_BATCH_BYTES = 2_000_000;
const MAX_DOCUMENT_BYTES = 800_000;
const names: Record<Dataset, string[]> = {
  course: ['courseUnits', 'courseAttempts'],
  pilot: ['pilotAttempts', 'pilotReviews', 'pilotNotes', 'pilotSessions'],
};
const stateName = (dataset: Dataset) =>
  dataset === 'course' ? 'main' : 'pilot';
const object = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message: string): never => {
  throw new Error(message);
};
const normalized = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
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
const stableJson = (value: unknown) => JSON.stringify(stable(value));
const same = (left: unknown, right: unknown) =>
  stableJson(left) === stableJson(right);
const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length;

export class IncompleteImportError extends Error {
  readonly digest: string;
  readonly counts: Record<string, number>;
  constructor(marker?: ImportMarker) {
    super(
      'The initial account import is incomplete. Resume with the same saved source or backup; no partial history has been loaded.',
    );
    this.name = 'IncompleteImportError';
    this.digest = marker?.digest ?? '';
    this.counts = marker?.counts ?? {};
  }
}

/** Database keys are transport details; original IDs stay unchanged in values/backups. */
export function cloudRecordId(id: string): string {
  if (!id || id === '.' || id === '..')
    return fail(
      'This saved record has an unsupported identity. Keep its original backup.',
    );
  const encoded = encodeURIComponent(id);
  if (new TextEncoder().encode(encoded).length > 1400)
    return fail(
      'This saved record identity is too large for cloud storage. Keep its original backup.',
    );
  return encoded;
}
function accountPath(uid: string) {
  if (
    !uid ||
    uid.length > 128 ||
    uid.includes('/') ||
    uid === '.' ||
    uid === '..'
  )
    return fail('An authenticated account identity is required.');
  return `users/${uid}`;
}
const rootRef = (db: Firestore, uid: string, dataset: Dataset) =>
  doc(db, accountPath(uid), 'state', stateName(dataset));
const markerRef = (db: Firestore, uid: string, dataset: Dataset) =>
  doc(db, accountPath(uid), 'state', `import-${stateName(dataset)}`);
function validation<T>(
  dataset: Dataset,
  validate?: Validator<T>,
): Validator<T> {
  if (validate) return validate;
  if (dataset === 'course') return (value) => validateLearnerState(value) as T;
  return fail('Pilot cloud storage requires its loaded curriculum validator.');
}
function envelope(value: unknown): Envelope {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    value.initialized !== true ||
    typeof value.revision !== 'string' ||
    !value.revision ||
    !object(value.metadata)
  )
    return fail(
      'Saved account metadata is invalid. Its records have been preserved.',
    );
  return value as Envelope;
}
function marker(value: unknown): ImportMarker {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !['importing', 'ready'].includes(String(value.status)) ||
    typeof value.digest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.digest) ||
    !object(value.counts) ||
    Object.values(value.counts).some(
      (count) => !Number.isSafeInteger(count) || Number(count) < 0,
    )
  )
    return fail(
      'Saved account import metadata is invalid. Its records have been preserved.',
    );
  return value as ImportMarker;
}
function split(
  dataset: Dataset,
  state: unknown,
): { metadata: JsonRecord; rows: Row[] } {
  if (dataset === 'course') {
    const records = splitCourseState(state as LearnerState);
    return {
      metadata: records.metadata,
      rows: [
        ...records.units.map((value) => ({
          collection: 'courseUnits',
          id: value.id,
          value,
        })),
        ...records.attempts.map((value, order) => ({
          collection: 'courseAttempts',
          id: value.id,
          value: { order, value },
        })),
      ],
    };
  }
  const records = splitPilotState(state as StudyState);
  return {
    metadata: records.metadata,
    rows: [
      ...records.attempts.map((value, order) => ({
        collection: 'pilotAttempts',
        id: value.id,
        value: { order, value },
      })),
      ...records.reviews.map((value) => ({
        collection: 'pilotReviews',
        id: value.id,
        value,
      })),
      ...records.notes.map((value, order) => ({
        collection: 'pilotNotes',
        id: value.id,
        value: { order, value },
      })),
      ...records.sessions.map((value, order) => ({
        collection: 'pilotSessions',
        id: value.id,
        value: { order, value },
      })),
    ],
  };
}
function assertRow(row: Row) {
  cloudRecordId(row.id);
  if (bytes(row.value) > MAX_DOCUMENT_BYTES)
    fail(
      'A saved record is too large for a safe cloud write. Keep your local work and export it.',
    );
}
function plainRows(rows: StoredRow[]): JsonRecord[] {
  return rows.map(({ key, value }) => {
    if (typeof value.id !== 'string' || cloudRecordId(value.id) !== key)
      return fail(
        'Saved account record identities do not match. Records have been preserved.',
      );
    return value;
  });
}
function arrayRows(rows: StoredRow[]): JsonRecord[] {
  return rows
    .map(({ key, value }) => {
      if (
        !Number.isSafeInteger(value.order) ||
        Number(value.order) < 0 ||
        !object(value.value) ||
        typeof value.value.id !== 'string' ||
        cloudRecordId(value.value.id) !== key
      )
        return fail(
          'Saved account history is invalid. Records have been preserved.',
        );
      return { order: Number(value.order), key, data: value.value };
    })
    .sort(
      (left, right) =>
        left.order - right.order || left.key.localeCompare(right.key),
    )
    .map(({ data }) => data);
}
function assemble<T>(
  dataset: Dataset,
  metadata: JsonRecord,
  rows: Record<string, StoredRow[]>,
  validate: Validator<T>,
): T {
  if (dataset === 'course') {
    const records = {
      metadata,
      units: plainRows(rows.courseUnits),
      attempts: arrayRows(rows.courseAttempts),
    } as unknown as CourseRecords;
    return validate(assembleCourseState(records));
  }
  const records = {
    metadata,
    attempts: arrayRows(rows.pilotAttempts),
    reviews: plainRows(rows.pilotReviews),
    notes: arrayRows(rows.pilotNotes),
    sessions: arrayRows(rows.pilotSessions),
  } as unknown as PilotRecords;
  return assemblePilotState(
    records,
    validate as unknown as Validator<StudyState>,
  ) as T;
}
async function readCollection(
  db: Firestore,
  uid: string,
  name: string,
  firstOnly = false,
): Promise<StoredRow[]> {
  const ref = collection(db, accountPath(uid), name);
  const result: StoredRow[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
  while (true) {
    const page = await getDocsFromServer(
      query(
        ref,
        orderBy(documentId()),
        limit(firstOnly ? 1 : PAGE_SIZE),
        ...(cursor ? [startAfter(cursor)] : []),
      ),
    );
    for (const record of page.docs)
      result.push({ key: record.id, value: record.data() });
    if (firstOnly || page.size < PAGE_SIZE) return result;
    cursor = page.docs[page.docs.length - 1];
  }
}
async function readRows(
  db: Firestore,
  uid: string,
  dataset: Dataset,
  firstOnly = false,
) {
  return Object.fromEntries(
    await Promise.all(
      names[dataset].map(
        async (name) =>
          [name, await readCollection(db, uid, name, firstOnly)] as const,
      ),
    ),
  );
}

/** A denied/offline/malformed read is never interpreted as a new empty account. */
export async function loadDataset<T>(
  db: Firestore,
  uid: string,
  dataset: Dataset,
  validate: Validator<T>,
): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const [before, beforeMarker] = await Promise.all([
      getDocFromServer(rootRef(db, uid, dataset)),
      getDocFromServer(markerRef(db, uid, dataset)),
    ]);
    const importState = beforeMarker.exists()
      ? marker(beforeMarker.data())
      : null;
    if (importState?.status === 'importing')
      throw new IncompleteImportError(importState);
    if (!before.exists()) {
      if (importState) throw new IncompleteImportError(importState);
      const rows = await readRows(db, uid, dataset, true);
      const [after, afterMarker] = await Promise.all([
        getDocFromServer(rootRef(db, uid, dataset)),
        getDocFromServer(markerRef(db, uid, dataset)),
      ]);
      if (after.exists() || afterMarker.exists()) continue;
      if (Object.values(rows).some((items) => items.length))
        return fail(
          'Uninitialized account records already exist. They were preserved; do not overwrite them with an empty profile.',
        );
      return null;
    }
    const initial = envelope(before.data());
    const rows = await readRows(db, uid, dataset);
    const after = await getDocFromServer(rootRef(db, uid, dataset));
    if (!after.exists() || envelope(after.data()).revision !== initial.revision)
      continue;
    return assemble(dataset, initial.metadata, rows, validate);
  }
  return fail(
    'Your account changed while it was loading. Retry to load a complete learning record.',
  );
}

type FieldChange = { path: string[]; value: unknown };
function changedFields(
  before: JsonRecord,
  after: JsonRecord,
  prefix: string[] = [],
): FieldChange[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(
    (key) => {
      if (same(before[key], after[key])) return [];
      return [
        {
          path: [...prefix, key],
          value: key in after ? after[key] : deleteField(),
        },
      ];
    },
  );
}
function updateFields(
  batch: WriteBatch,
  ref: DocumentReference,
  fields: FieldChange[],
) {
  if (!fields.length) return;
  const [first, ...rest] = fields;
  batch.update(
    ref,
    new FieldPath(...first.path),
    first.value,
    ...rest.flatMap((field) => [new FieldPath(...field.path), field.value]),
  );
}
function courseUnitChanges(
  before: JsonRecord,
  after: JsonRecord,
): FieldChange[] {
  const result: FieldChange[] = [];
  if (!same(before.review, after.review))
    result.push({ path: ['review'], value: after.review });
  if (object(before.position) && object(after.position)) {
    for (const field of changedFields(before.position, after.position, [
      'position',
    ])) {
      const key = field.path[1];
      if (
        ['checks', 'exploration'].includes(key) &&
        object(before.position[key]) &&
        object(after.position[key])
      )
        result.push(
          ...changedFields(before.position[key], after.position[key], [
            'position',
            key,
          ]),
        );
      else result.push(field);
    }
  } else if (!same(before.position, after.position))
    result.push({ path: ['position'], value: after.position });
  return result;
}

/** A small normal save is atomic; large migration belongs to explicit adoption. */
export async function saveDataset<T>(
  db: Firestore,
  uid: string,
  dataset: Dataset,
  previous: T,
  next: T,
  validate?: Validator<T>,
): Promise<void> {
  const check = validation(dataset, validate);
  const before = normalized(check(previous));
  const after = normalized(check(next));
  if (same(before, after)) return;
  if (dataset === 'course')
    assertCourseAnswersPreserved(before as LearnerState, after as LearnerState);
  else assertPilotAnswersPreserved(before as StudyState, after as StudyState);
  const old = split(dataset, before);
  const current = split(dataset, after);
  const oldById = new Map(
    old.rows.map((row) => [`${row.collection}/${row.id}`, row.value]),
  );
  const changed = current.rows.filter(
    (row) => !same(oldById.get(`${row.collection}/${row.id}`), row.value),
  );
  const currentIds = new Set(
    current.rows.map((row) => `${row.collection}/${row.id}`),
  );
  const removed = old.rows.filter(
    (row) => !currentIds.has(`${row.collection}/${row.id}`),
  );
  const mutable = new Set(['courseUnits', 'pilotReviews', 'pilotNotes']);
  if (removed.some((row) => !mutable.has(row.collection)))
    return fail(
      'An ordinary account save cannot remove saved answer or completed-session history.',
    );
  changed.forEach(assertRow);
  const metadata: Envelope = {
    schemaVersion: 1,
    initialized: true,
    revision: crypto.randomUUID(),
    metadata: current.metadata,
  };
  if (
    bytes(metadata) > MAX_DOCUMENT_BYTES ||
    changed.length + removed.length + 1 > MAX_NORMAL_BATCH_WRITES ||
    changed.reduce((total, row) => total + bytes(row.value), bytes(metadata)) +
      removed.reduce(
        (total, row) =>
          total +
          new TextEncoder().encode(
            `${accountPath(uid)}/${row.collection}/${cloudRecordId(row.id)}`,
          ).length,
        0,
      ) >
      MAX_BATCH_BYTES
  )
    return fail(
      'Too many unsynced changes for one safe account save. Your local work is retained; export it before recovery.',
    );
  const batch = writeBatch(db);
  for (const row of changed) {
    const ref = doc(
      db,
      accountPath(uid),
      row.collection,
      cloudRecordId(row.id),
    );
    const oldValue = oldById.get(`${row.collection}/${row.id}`);
    if (!oldValue) batch.set(ref, row.value);
    else
      updateFields(
        batch,
        ref,
        row.collection === 'courseUnits'
          ? courseUnitChanges(oldValue, row.value)
          : changedFields(oldValue, row.value),
      );
  }
  for (const row of removed)
    batch.delete(
      doc(db, accountPath(uid), row.collection, cloudRecordId(row.id)),
    );
  const metadataChanges = changedFields(old.metadata, current.metadata, [
    'metadata',
  ]).flatMap((field) =>
    field.path[1] === 'preferences' &&
    object(old.metadata.preferences) &&
    object(current.metadata.preferences)
      ? changedFields(old.metadata.preferences, current.metadata.preferences, [
          'metadata',
          'preferences',
        ])
      : [field],
  );
  // update deliberately refuses to recreate a missing/deleted initialized root.
  updateFields(batch, rootRef(db, uid, dataset), [
    { path: ['revision'], value: metadata.revision },
    ...metadataChanges,
  ]);
  await batch.commit();
}

async function sourceDigest(source: unknown) {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(stableJson(source)),
  );
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
function countsFor(dataset: Dataset, rows: Row[]) {
  return Object.fromEntries(
    names[dataset].map((name) => [
      name,
      rows.filter((row) => row.collection === name).length,
    ]),
  );
}
function chunks(rows: Row[]) {
  const result: Row[][] = [];
  let current: Row[] = [],
    total = 0;
  for (const row of rows) {
    const size = bytes(row.value);
    if (
      current.length &&
      (current.length >= MAX_IMPORT_BATCH_WRITES - 1 ||
        total + size > MAX_BATCH_BYTES)
    ) {
      result.push(current);
      current = [];
      total = 0;
    }
    current.push(row);
    total += size;
  }
  if (current.length) result.push(current);
  return result;
}

/** Initial adoption only; an interrupted import stays non-ready until exact replay. */
export async function adoptDataset<T>(
  db: Firestore,
  uid: string,
  dataset: Dataset,
  source: T,
  validate?: Validator<T>,
): Promise<T> {
  const check = validation(dataset, validate);
  const candidate = normalized(check(source));
  const records = split(dataset, candidate);
  records.rows.forEach(assertRow);
  const metadata: Envelope = {
    schemaVersion: 1,
    initialized: true,
    revision: crypto.randomUUID(),
    metadata: records.metadata,
  };
  if (bytes(metadata) > MAX_DOCUMENT_BYTES)
    return fail(
      'Account metadata is too large for a safe cloud import. Keep the original backup.',
    );
  const digest = await sourceDigest(candidate);
  const counts = countsFor(dataset, records.rows);
  try {
    const current = await loadDataset(db, uid, dataset, check);
    if (current !== null) {
      const completed = await getDocFromServer(markerRef(db, uid, dataset));
      if (
        completed.exists() &&
        marker(completed.data()).status === 'ready' &&
        marker(completed.data()).digest === digest &&
        same(current, candidate)
      )
        return current;
      return fail(
        'This account dataset is already initialized. Continue its saved learning or export the local backup; cloud replacement is not enabled.',
      );
    }
  } catch (error) {
    if (!(error instanceof IncompleteImportError) || error.digest !== digest)
      throw error;
  }
  await runTransaction(db, async (transaction) => {
    const root = await transaction.get(rootRef(db, uid, dataset));
    const existing = await transaction.get(markerRef(db, uid, dataset));
    if (root.exists())
      return fail(
        'This account dataset is already initialized. Its progress has not been replaced.',
      );
    if (existing.exists()) {
      const pending = marker(existing.data());
      if (
        pending.status !== 'importing' ||
        pending.digest !== digest ||
        !same(pending.counts, counts)
      )
        throw new IncompleteImportError(pending);
      return;
    }
    transaction.set(markerRef(db, uid, dataset), {
      schemaVersion: 1,
      status: 'importing',
      digest,
      counts,
    });
  });
  for (const rows of chunks(records.rows)) {
    const batch = writeBatch(db);
    for (const row of rows)
      batch.set(
        doc(db, accountPath(uid), row.collection, cloudRecordId(row.id)),
        row.value,
      );
    // Keep the import gate in this batch so a finalized import cannot resume stale chunks.
    batch.set(markerRef(db, uid, dataset), {
      schemaVersion: 1,
      status: 'importing',
      digest,
      counts,
    });
    await batch.commit();
  }
  const savedRows = await readRows(db, uid, dataset);
  if (
    !same(
      Object.fromEntries(
        names[dataset].map((name) => [name, savedRows[name].length]),
      ),
      counts,
    )
  )
    return fail(
      'The initial account import has unexpected records. It remains incomplete; keep the original backup.',
    );
  const restored = assemble(dataset, records.metadata, savedRows, check);
  if (!same(restored, candidate))
    return fail(
      'The initial account import did not preserve its complete source. It remains incomplete; keep the original backup.',
    );
  const final = writeBatch(db);
  final.set(rootRef(db, uid, dataset), metadata);
  final.set(markerRef(db, uid, dataset), {
    schemaVersion: 1,
    status: 'ready',
    digest,
    counts,
  });
  await final.commit();
  return restored;
}
