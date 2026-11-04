export type Lesson = {
  id: string;
  title: string;
  subtitle: string;
  domain: number;
  minutes: number;
  objective: string;
  summary: string;
  sections: { title: string; body: string }[];
  analogy: string;
  misconception: { wrong: string; right: string };
  takeaway: string;
  recall: { question: string; answer: string };
  sources: { title: string; url: string }[];
  review: { status: string; date: string; note: string };
};
export type Question = {
  contentRelease?: string;
  id: string;
  conceptId: string;
  variant: number;
  stem: string;
  options: string[];
  correctIndex: number;
  explanations: string[];
  decisiveDetail: string;
  takeaway: string;
  source: { title: string; url: string };
  review: { status: string; date: string };
};
export type Domain = {
  id: number;
  name: string;
  short: string;
  weight: number;
  color: string;
};
export type ConceptNode = {
  id: string;
  parentId: string | null;
  rootConceptId: string;
  domainId: number;
  title: string;
  summary: string;
  objective: string;
  order: number;
  details: { heading: string; body: string }[];
  sourceUrls: string[];
  relatedIds: string[];
};
export type DiagramItem = {
  id: string;
  label: string;
  detail: string;
  role?: 'decision';
};
export type DiagramBlock = {
  id: string;
  type: 'diagram';
  afterSection: number;
  kind: 'flow' | 'comparison' | 'layers' | 'timeline' | 'decision';
  title: string;
  caption: string;
  items: DiagramItem[];
  links: { from: string; to: string; label: string }[];
};
export type CheckBlock = {
  id: string;
  type: 'check';
  afterSection: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hint: string;
};
export type LeadVisual = {
  kind: 'stages' | 'factors' | 'access-models' | 'risk';
  title: string;
  caption: string;
  steps?: { title: string; detail: string }[];
  models?: Record<
    string,
    { policy: string; input: string; answer: string; reason: string }
  >;
  prompt?: string;
};
export type LearningDesign = {
  leadVisual: LeadVisual;
  conceptId: string;
  cardVisual: {
    kind: string;
    title: string;
    caption: string;
    items: DiagramItem[];
    connections?: { from: string; to: string; label: string }[];
  };
  blocks: (DiagramBlock | CheckBlock)[];
};
export type QuestionMetadata = {
  questionId: string;
  domainId: number;
  objective: string;
  subtopicIds: string[];
  tags: string[];
  hint: string;
  learningLinks: { lessonId: string; sectionIndex: number; label: string }[];
  difficulty: string;
  misconception: string;
};
export type EnrichedQuestion = Question & { metadata: QuestionMetadata };
export type Curriculum = {
  releaseId: string;
  storage: 'D1';
  lessons: (Lesson & { design: LearningDesign })[];
  questions: EnrichedQuestion[];
  nodes: ConceptNode[];
  domains: Domain[];
  edges: { from: string; to: string; label: string }[];
};
