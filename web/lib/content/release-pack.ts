import lessons from '../data/lessons.json' with { type: 'json' };
import questions from '../data/questions.json' with { type: 'json' };
import edges from '../data/edges.json' with { type: 'json' };
import taxonomy from '../data/taxonomy.json' with { type: 'json' };
import designs from '../data/learning-design.json' with { type: 'json' };
import metadata from '../data/question-metadata.json' with { type: 'json' };
import { domainSeed } from './domains.ts';
import { validateRelease } from './validate.ts';
import type {
  Curriculum,
  ConceptNode,
  LearningDesign,
  QuestionMetadata,
} from '../curriculum.ts';
const releaseId = 'cissp-foundations-2026-09-06-r2';
export const releasePack: Curriculum = {
  releaseId,
  storage: 'static',
  domains: domainSeed,
  nodes: taxonomy as ConceptNode[],
  edges,
  lessons: lessons.map((l) => ({
    ...l,
    design: designs.find((d) => d.conceptId === l.id) as LearningDesign,
  })),
  questions: questions.map((q) => ({
    ...q,
    contentRelease: releaseId,
    metadata: metadata.find((m) => m.questionId === q.id) as QuestionMetadata,
  })),
};
validateRelease(releasePack);
