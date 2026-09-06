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
