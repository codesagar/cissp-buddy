import type { Curriculum } from '../curriculum';
import { getContentDatabase } from './database';
import { releasePack } from './release-pack';
export async function ensureContentRelease(
  db: D1Database = getContentDatabase(),
): Promise<void> {
  const existing = await db
    .prepare('SELECT id FROM content_releases WHERE id = ?')
    .bind(releasePack.releaseId)
    .first();
  if (existing) return;
  // One bounded, atomic seed transaction; schema changes are owned solely by Drizzle migrations.
  const statements: D1PreparedStatement[] = [];
  for (const d of releasePack.domains)
    statements.push(
      db
        .prepare(
          'INSERT INTO domains(id,name,payload_json) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,payload_json=excluded.payload_json',
        )
        .bind(d.id, d.name, JSON.stringify(d)),
    );
  const remaining = [...releasePack.nodes],
    inserted = new Set<string>();
  while (remaining.length) {
    const index = remaining.findIndex(
      (n) => !n.parentId || inserted.has(n.parentId),
    );
    if (index < 0) throw new Error('Invalid hierarchy: unresolved parent');
    const [n] = remaining.splice(index, 1);
    inserted.add(n.id);
    statements.push(
      db
        .prepare(
          'INSERT INTO concepts(id,parent_id,root_id,domain_id,title,sort_order,payload_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET parent_id=excluded.parent_id,root_id=excluded.root_id,domain_id=excluded.domain_id,title=excluded.title,sort_order=excluded.sort_order,payload_json=excluded.payload_json',
        )
        .bind(
          n.id,
          n.parentId,
          n.rootConceptId,
          n.domainId,
          n.title,
          n.order,
          JSON.stringify(n),
        ),
    );
  }
  for (const l of releasePack.lessons)
    statements.push(
      db
        .prepare(
          'INSERT INTO lessons(id,concept_id,revision,status,payload_json) VALUES(?,?,?, ?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,status=excluded.status,payload_json=excluded.payload_json',
        )
        .bind(l.id, l.id, 2, l.review.status, JSON.stringify(l)),
    );
  const oldRows = await db
    .prepare('SELECT id,payload_json FROM questions')
    .all<{ id: string; payload_json: string }>();
  const oldQuestions = new Map(oldRows.results.map((r) => [r.id, r]));
  if (
    oldRows.results.some(
      (r) => !releasePack.questions.some((q) => q.id === r.id),
    )
  )
    throw new Error('Additive releases must retain historical question IDs.');
  const oldConcepts = await db
    .prepare('SELECT id FROM concepts')
    .all<{ id: string }>();
  if (
    oldConcepts.results.some(
      (r) => !releasePack.nodes.some((n) => n.id === r.id),
    )
  )
    throw new Error('Additive releases must retain historical concept IDs.');
  for (const q of releasePack.questions) {
    const old = oldQuestions.get(q.id);
    if (old) {
      const before = JSON.parse(old.payload_json) as typeof q;
      if (
        before.conceptId !== q.conceptId ||
        before.metadata.domainId !== q.metadata.domainId ||
        before.stem !== q.stem ||
        before.correctIndex !== q.correctIndex ||
        JSON.stringify(before.options) !== JSON.stringify(q.options)
      )
        throw new Error(
          `Question ${q.id} changed answer semantics; publish under a new ID.`,
        );
    }
    statements.push(
      db
        .prepare(
          'INSERT INTO questions(id,concept_id,domain_id,revision,payload_json) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload_json=excluded.payload_json',
        )
        .bind(q.id, q.conceptId, q.metadata.domainId, 2, JSON.stringify(q)),
    );
    statements.push(
      db
        .prepare('DELETE FROM question_subtopics WHERE question_id = ?')
        .bind(q.id),
    );
    statements.push(
      db
        .prepare('DELETE FROM question_learning_links WHERE question_id = ?')
        .bind(q.id),
    );
    for (const id of q.metadata.subtopicIds)
      statements.push(
        db
          .prepare(
            'INSERT INTO question_subtopics(question_id,concept_id) VALUES(?,?) ON CONFLICT DO NOTHING',
          )
          .bind(q.id, id),
      );
    for (const link of q.metadata.learningLinks)
      statements.push(
        db
          .prepare(
            'INSERT INTO question_learning_links(question_id,lesson_id,section_index,label) VALUES(?,?,?,?) ON CONFLICT(question_id,lesson_id,section_index) DO UPDATE SET label=excluded.label',
          )
          .bind(q.id, link.lessonId, link.sectionIndex, link.label),
      );
  }
  statements.push(db.prepare('DELETE FROM concept_relationships'));
  const links = [
    ...releasePack.edges,
    ...releasePack.nodes.flatMap((n) =>
      n.relatedIds.map((to) => ({ from: n.id, to, label: 'related' })),
    ),
  ];
  for (const e of links)
    statements.push(
      db
        .prepare(
          'INSERT INTO concept_relationships(from_id,to_id,kind) VALUES(?,?,?) ON CONFLICT DO NOTHING',
        )
        .bind(e.from, e.to, e.label),
    );
  // Immutable release snapshot resolves historical content even after the current relational records change.
  statements.push(
    db
      .prepare(
        'INSERT INTO content_releases(id,published_at,manifest_json) VALUES(?,?,?) ON CONFLICT DO NOTHING',
      )
      .bind(
        releasePack.releaseId,
        '2026-09-06T14:00:00Z',
        JSON.stringify(releasePack),
      ),
  );
  await db.batch(statements);
}
const manifestCache = new Map<string, Curriculum>();
export async function readCurriculum(
  releaseId = releasePack.releaseId,
): Promise<Curriculum> {
  const cached = manifestCache.get(releaseId);
  if (cached) return cached;
  const db = getContentDatabase();
  await ensureContentRelease(db);
  const row = await db
    .prepare('SELECT manifest_json FROM content_releases WHERE id = ?')
    .bind(releaseId)
    .first<{ manifest_json: string }>();
  if (!row) throw new Error('This curriculum release is unavailable.');
  const pack = JSON.parse(row.manifest_json) as Curriculum;
  if (manifestCache.size >= 3)
    manifestCache.delete(manifestCache.keys().next().value!);
  manifestCache.set(releaseId, pack);
  return pack;
}
export async function queryConcepts({
  parentId,
  domainId,
  query = '',
  offset = 0,
  limit = 50,
}: {
  parentId?: string | null;
  domainId?: number;
  query?: string;
  offset?: number;
  limit?: number;
}) {
  const db = getContentDatabase();
  await ensureContentRelease(db);
  const clauses: string[] = [],
    values: (string | number)[] = [];
  if (parentId !== undefined) {
    clauses.push(parentId === null ? 'parent_id IS NULL' : 'parent_id = ?');
    if (parentId !== null) values.push(parentId);
  }
  if (domainId) {
    clauses.push('domain_id = ?');
    values.push(domainId);
  }
  if (query) {
    clauses.push('title LIKE ?');
    values.push(`%${query.replaceAll('%', '').replaceAll('_', '')}%`);
  }
  values.push(Math.min(100, Math.max(1, limit)), Math.max(0, offset));
  const result = await db
    .prepare(
      `SELECT payload_json FROM concepts ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''} ORDER BY domain_id,sort_order,id LIMIT ? OFFSET ?`,
    )
    .bind(...values)
    .all<{ payload_json: string }>();
  return result.results.map(
    (r) => JSON.parse(r.payload_json) as Curriculum['nodes'][number],
  );
}

export async function queryQuestions({
  domainId,
  subtopicId,
  offset = 0,
  limit = 25,
}: {
  domainId?: number;
  subtopicId?: string;
  offset?: number;
  limit?: number;
}) {
  const db = getContentDatabase();
  await ensureContentRelease(db);
  const clauses: string[] = [],
    values: (string | number)[] = [];
  if (domainId) {
    clauses.push('q.domain_id = ?');
    values.push(domainId);
  }
  if (subtopicId) {
    clauses.push(
      'EXISTS (SELECT 1 FROM question_subtopics s WHERE s.question_id=q.id AND s.concept_id=?)',
    );
    values.push(subtopicId);
  }
  values.push(limit, offset);
  const rows = await db
    .prepare(
      `SELECT q.payload_json FROM questions q ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''} ORDER BY q.id LIMIT ? OFFSET ?`,
    )
    .bind(...values)
    .all<{ payload_json: string }>();
  return rows.results.map(
    (r) => JSON.parse(r.payload_json) as Curriculum['questions'][number],
  );
}
