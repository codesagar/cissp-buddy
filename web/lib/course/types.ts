/** Shared production contract. Root owns this file; coordinate changes before editing. */
export type TeachingNode = {
  id: string;
  label: string;
  detail: string;
  conceptIds: string[];
  lane?: string;
};
export type TeachingEdge = {
  from: string;
  to: string;
  label: string;
  kind?: 'flow' | 'dependency' | 'evidence' | 'blocked';
};
export type TeachingMatrix = {
  title: string;
  description: string;
  columns: { id: string; label: string }[];
  rows: {
    id: string;
    label: string;
    cells: Record<string, string>;
  }[];
  notes?: string[];
};
export type TeachingEvidenceRecord = {
  title: string;
  fields: { label: string; value: string }[];
  note: string;
};
export type TeachingSpatialPlan = {
  title: string;
  description: string;
  locations: {
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    kind: 'public' | 'controlled' | 'restricted' | 'safety';
  }[];
  paths: {
    id: string;
    label: string;
    points: string;
    kind: 'entry' | 'egress' | 'reentry';
  }[];
  notes: string[];
};
export type TeachingState = {
  id: string;
  title: string;
  caption: string;
  activeNodeIds: string[];
  activeEdgeIndexes?: number[];
  activeRowIds?: string[];
  statuses?: Record<string, string>;
};
export type TeachingCheck = {
  id: string;
  prompt: string;
  options: {
    id: string;
    label: string;
    correct: boolean;
    feedback: string;
    repairStateId: string;
  }[];
  conceptIds: string[];
  hint: string;
};
export type RecoveryTimelineData = {
  kind: 'recovery-timeline';
  unit: 'minutes' | 'hours';
  lastRecoverableAt: number;
  interruptionAt: 0;
  rpoLimit: number;
  restoreAt: number;
  rtoLimit: number;
  disruptionLimit: number;
  acceptanceAt: number;
  description: string;
};
export type TeachingQuantitative = RecoveryTimelineData;
export type TeachingModel = {
  schemaVersion: 1;
  unitId: string;
  treatmentIds: string[];
  title: string;
  question: string;
  scenario: string;
  focalRelation: string;
  representation:
    | 'decision'
    | 'boundary'
    | 'sequence'
    | 'state'
    | 'comparison'
    | 'ledger'
    | 'timeline'
    | 'quantitative';
  nodes: TeachingNode[];
  edges: TeachingEdge[];
  lanes?: { id: string; label: string; rule: string }[];
  learningJob?: {
    plainExplanation: string;
    visualReasoningGain: string;
  };
  openingFacts?: { label: string; value: string }[];
  matrix?: TeachingMatrix;
  evidenceRecord?: TeachingEvidenceRecord;
  spatialPlan?: TeachingSpatialPlan;
  quantitative?: RecoveryTimelineData;
  states: TeachingState[];
  variants?: {
    id: string;
    label: string;
    changedFact: string;
    nodes?: TeachingNode[];
    edges?: TeachingEdge[];
    lanes?: { id: string; label: string; rule: string }[];
    matrix?: TeachingMatrix;
    evidenceRecord?: TeachingEvidenceRecord;
    spatialPlan?: TeachingSpatialPlan;
    states: TeachingState[];
    quantitative?: RecoveryTimelineData;
  }[];
  prediction: TeachingCheck;
  transfer: TeachingCheck;
  retry: TeachingCheck;
  takeaway: string;
  assumptions: string[];
  sourceRefIds: string[];
  treatmentDispositions: {
    treatmentId: string;
    disposition: 'implemented' | 'equivalent' | 'replaced';
    rationale: string;
  }[];
};
export type CourseConcept = {
  id: string;
  label: string;
  definition: string;
  decision: string;
  failureExample: string;
  sourceVisualId: string;
  sourceRefIds: string[];
};
export type CourseUnit = {
  id: string;
  domainId: number;
  objectiveIds: string[];
  title: string;
  summary: string;
  outcome: string;
  conceptIds: string[];
  prerequisites: string[];
  estimatedMinutes: number;
  sections: {
    id: string;
    title: string;
    body: string;
    keyPoints: string[];
    sourceRefIds: string[];
  }[];
  workedExamples: {
    title: string;
    situation: string;
    reasoning: string;
    takeaway: string;
  }[];
  misconceptions: { claim: string; correction: string }[];
  sourceRefs: {
    id: string;
    sourceId: string;
    locator: Record<string, unknown>;
    supports: string[];
  }[];
  concepts: CourseConcept[];
  teaching: TeachingModel | null;
  sourcePath: string;
  sourceHash: string;
  releaseId: string;
};
export type UnitSummary = Pick<
  CourseUnit,
  | 'id'
  | 'domainId'
  | 'objectiveIds'
  | 'title'
  | 'summary'
  | 'outcome'
  | 'conceptIds'
  | 'estimatedMinutes'
> & {
  teachingReady: boolean;
  conceptLabels?: string[];
  prerequisites?: string[];
  checks?: { id: string; conceptIds: string[] }[];
};
export type CourseManifest = {
  releaseId: string;
  sourceHash: string;
  publishedAt: string;
  domains: { id: number; name: string; short: string; weight: number }[];
  units: UnitSummary[];
  counts: {
    units: number;
    concepts: number;
    conceptOccurrences: number;
    teachingModels: number;
    assessments: number;
  };
};
export type ConnectionSummary = {
  id: string;
  title: string;
  unitIds: string[];
  relationshipIds: string[];
};
export type ReferenceRelationship = {
  id: string;
  fromObjectiveId: string;
  toObjectiveId: string;
  kind: string;
  directionality: 'directed';
  rationale: string;
  storyboardId: string;
  reason: string;
  sourceSupport: { sourceIds: string[]; note: string };
};
export type CourseConnection = ConnectionSummary & {
  releaseId: string;
  model: TeachingModel;
};
export type CourseConnectionsIndex = {
  releaseId: string;
  cases: ConnectionSummary[];
  referenceRelationships: ReferenceRelationship[];
};
export type ConnectionIndex = CourseConnectionsIndex;
export type ConnectionDetail = CourseConnection;
