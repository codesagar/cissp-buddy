import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  foreignKey,
} from 'drizzle-orm/sqlite-core';
export const releases = sqliteTable('content_releases', {
  id: text('id').primaryKey(),
  publishedAt: text('published_at').notNull(),
  manifest: text('manifest_json').notNull(),
});
export const courseReleases = sqliteTable(
  'course_releases',
  {
    id: text('id').primaryKey(),
    sourceHash: text('source_hash').notNull(),
    publishedAt: text('published_at').notNull(),
    manifest: text('manifest_json').notNull(),
    unitCount: integer('unit_count').notNull(),
    conceptCount: integer('concept_count').notNull(),
    conceptOccurrenceCount: integer('concept_occurrence_count').notNull(),
    teachingModelCount: integer('teaching_model_count').notNull(),
    assessmentCount: integer('assessment_count').notNull(),
    sealed: integer('sealed', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('course_releases_source_hash').on(t.sourceHash)],
);
export const courseUnits = sqliteTable(
  'course_units',
  {
    releaseId: text('release_id')
      .notNull()
      .references(() => courseReleases.id),
    unitId: text('unit_id').notNull(),
    domainId: integer('domain_id').notNull(),
    sortOrder: integer('sort_order').notNull(),
    sourceHash: text('source_hash').notNull(),
    payload: text('payload_json').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.releaseId, t.unitId] }),
    index('course_units_release_domain_order').on(
      t.releaseId,
      t.domainId,
      t.sortOrder,
    ),
    index('course_units_unit_release').on(t.unitId, t.releaseId),
  ],
);
export const courseSourceBindings = sqliteTable(
  'course_source_bindings',
  {
    releaseId: text('release_id')
      .notNull()
      .references(() => courseReleases.id),
    unitId: text('unit_id').notNull(),
    conceptId: text('concept_id').notNull(),
    sourceVisualId: text('source_visual_id').notNull(),
    payload: text('payload_json').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.releaseId, t.unitId, t.conceptId] }),
    index('course_source_bindings_release_unit').on(t.releaseId, t.unitId),
  ],
);
export const courseConnections = sqliteTable(
  'course_connections',
  {
    releaseId: text('release_id')
      .notNull()
      .references(() => courseReleases.id),
    connectionId: text('connection_id').notNull(),
    sortOrder: integer('sort_order').notNull(),
    payload: text('payload_json').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.releaseId, t.connectionId] }),
    index('course_connections_release_order').on(t.releaseId, t.sortOrder),
    index('course_connections_id_release').on(t.connectionId, t.releaseId),
  ],
);
export const courseReferenceRelationships = sqliteTable(
  'course_reference_relationships',
  {
    releaseId: text('release_id')
      .notNull()
      .references(() => courseReleases.id),
    relationshipId: text('relationship_id').notNull(),
    sortOrder: integer('sort_order').notNull(),
    payload: text('payload_json').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.releaseId, t.relationshipId] }),
    index('course_reference_relationships_release_order').on(
      t.releaseId,
      t.sortOrder,
    ),
  ],
);
export const domains = sqliteTable('domains', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  payload: text('payload_json').notNull(),
});
export const concepts = sqliteTable(
  'concepts',
  {
    id: text('id').primaryKey(),
    parentId: text('parent_id'),
    rootId: text('root_id').notNull(),
    domainId: integer('domain_id')
      .notNull()
      .references(() => domains.id),
    title: text('title').notNull(),
    sortOrder: integer('sort_order').notNull(),
    payload: text('payload_json').notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }),
    index('concepts_parent_order').on(t.parentId, t.sortOrder),
    index('concepts_domain').on(t.domainId),
  ],
);
export const relationships = sqliteTable(
  'concept_relationships',
  {
    fromId: text('from_id')
      .notNull()
      .references(() => concepts.id),
    toId: text('to_id')
      .notNull()
      .references(() => concepts.id),
    kind: text('kind').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.fromId, t.toId, t.kind] }),
    index('relationships_to').on(t.toId),
  ],
);
export const lessons = sqliteTable(
  'lessons',
  {
    id: text('id').primaryKey(),
    conceptId: text('concept_id')
      .notNull()
      .references(() => concepts.id),
    revision: integer('revision').notNull(),
    status: text('status').notNull(),
    payload: text('payload_json').notNull(),
  },
  (t) => [index('lessons_concept').on(t.conceptId)],
);
export const questions = sqliteTable(
  'questions',
  {
    id: text('id').primaryKey(),
    conceptId: text('concept_id')
      .notNull()
      .references(() => concepts.id),
    domainId: integer('domain_id')
      .notNull()
      .references(() => domains.id),
    revision: integer('revision').notNull(),
    payload: text('payload_json').notNull(),
  },
  (t) => [index('questions_domain_concept').on(t.domainId, t.conceptId)],
);
export const questionSubtopics = sqliteTable(
  'question_subtopics',
  {
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id),
    conceptId: text('concept_id')
      .notNull()
      .references(() => concepts.id),
  },
  (t) => [
    primaryKey({ columns: [t.questionId, t.conceptId] }),
    index('question_subtopics_concept').on(t.conceptId),
  ],
);
export const questionLinks = sqliteTable(
  'question_learning_links',
  {
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id),
    sectionIndex: integer('section_index').notNull(),
    label: text('label').notNull(),
  },
  (t) => [primaryKey({ columns: [t.questionId, t.lessonId, t.sectionIndex] })],
);
