export type Attempt = {
  id: string;
  questionId: string;
  conceptId: string;
  chosen: number;
  correct: boolean;
  guess: boolean;
  hintUsed?: boolean;
  at: number;
  answerMs: number;
  explanationMs: number;
  repeated: boolean;
  contentRelease?: string;
  questionSnapshot?: {
    stem: string;
    options: string[];
    correctIndex: number;
    explanations: string[];
  };
};
export type ReviewCard = {
  dueAt: number;
  intervalDays: number;
  lastAt: number;
  needsReview: boolean;
};
export type Note = {
  id: string;
  conceptId: string;
  text: string;
  createdAt: number;
};
export type Session = {
  id: string;
  questionIds: string[];
  index: number;
  phase: 'answer' | 'explanation';
  selected: number | null;
  guess: boolean;
  hintUsed?: boolean;
  attemptId: string | null;
  elapsedMs: number;
  phaseMs: number;
  label: string;
};
export type StudyState = {
  version: 1;
  visited: string[];
  completed: string[];
  attempts: Attempt[];
  reviews: Record<string, ReviewCard>;
  notes: Note[];
  active: Session | null;
  sessions: {
    id: string;
    completedAt: number;
    count: number;
    elapsedMs: number;
  }[];
};
export const STORAGE_KEY = 'cissp-buddy:v1';
export const DAY = 86400000;
export function emptyState(): StudyState {
  return {
    version: 1,
    visited: [],
    completed: [],
    attempts: [],
    reviews: {},
    notes: [],
    active: null,
    sessions: [],
  };
}
export function scheduleReview(
  previous: ReviewCard | undefined,
  correct: boolean,
  guess: boolean,
  now: number,
): ReviewCard {
  const needsReview = !correct || guess;
  const intervalDays = needsReview
    ? 1
    : previous && !previous.needsReview
      ? Math.min(30, previous.intervalDays * 2)
      : 3;
  return {
    dueAt: needsReview ? now : now + intervalDays * DAY,
    intervalDays,
    lastAt: now,
    needsReview,
  };
}
export function dueConcepts(state: StudyState, now: number): string[] {
  return Object.entries(state.reviews)
    .filter(([, v]) => v.dueAt <= now)
    .sort((a, b) => a[1].dueAt - b[1].dueAt || a[0].localeCompare(b[0]))
    .map(([id]) => id);
}
export function selectQuestions<
  T extends { id: string; conceptId: string; variant: number },
>(
  questions: T[],
  state: StudyState,
  mode: 'recommended' | 'mixed' | 'topic' | 'review',
  topic: string | undefined,
  now: number,
  limit = 4,
): T[] {
  const due = dueConcepts(state, now);
  const pool = questions.filter((q) =>
    mode === 'topic'
      ? q.conceptId === topic
      : mode === 'review'
        ? due.includes(q.conceptId)
        : true,
  );
  const counts = new Map<string, number>();
  state.attempts.forEach((a) =>
    counts.set(a.questionId, (counts.get(a.questionId) || 0) + 1),
  );
  const sorted = [...pool].sort((a, b) => {
    const seen = (counts.get(a.id) || 0) - (counts.get(b.id) || 0);
    if (seen) return seen;
    if (mode === 'recommended' || mode === 'review') {
      const priority =
        Number(due.includes(b.conceptId)) - Number(due.includes(a.conceptId));
      if (priority) return priority;
    }
    const exposure =
      state.attempts.filter((x) => x.conceptId === a.conceptId).length -
      state.attempts.filter((x) => x.conceptId === b.conceptId).length;
    return exposure || a.variant - b.variant || a.id.localeCompare(b.id);
  });
  const chosen: T[] = [];
  const used = new Set<string>();
  for (const q of sorted) {
    if (!used.has(q.conceptId)) {
      chosen.push(q);
      used.add(q.conceptId);
      if (chosen.length === limit) return chosen;
    }
  }
  for (const q of sorted) {
    if (!chosen.includes(q)) {
      chosen.push(q);
      if (chosen.length === limit) break;
    }
  }
  return chosen;
}
export function recordAnswer(
  state: StudyState,
  question: {
    id: string;
    conceptId: string;
    correctIndex: number;
    contentRelease?: string;
    stem?: string;
    options?: string[];
    explanations?: string[];
  },
  now: number,
): StudyState {
  const s = state.active;
  if (
    !s ||
    s.phase !== 'answer' ||
    s.selected === null ||
    s.questionIds[s.index] !== question.id
  )
    return state;
  const correct = s.selected === question.correctIndex;
  const attempt: Attempt = {
    id: `${s.id}:${s.index}`,
    questionId: question.id,
    conceptId: question.conceptId,
    chosen: s.selected,
    correct,
    guess: s.guess,
    hintUsed: !!s.hintUsed,
    contentRelease: question.contentRelease || 'mvp-v1',
    ...(question.stem && question.options && question.explanations
      ? {
          questionSnapshot: {
            stem: question.stem,
            options: [...question.options],
            correctIndex: question.correctIndex,
            explanations: [...question.explanations],
          },
        }
      : {}),
    at: now,
    answerMs: s.phaseMs,
    explanationMs: 0,
    repeated: state.attempts.some((a) => a.questionId === question.id),
  };
  if (state.attempts.some((a) => a.id === attempt.id)) return state;
  return {
    ...state,
    attempts: [...state.attempts, attempt],
    reviews: {
      ...state.reviews,
      [question.conceptId]: scheduleReview(
        state.reviews[question.conceptId],
        correct,
        s.guess || !!s.hintUsed,
        now,
      ),
    },
    active: { ...s, phase: 'explanation', phaseMs: 0, attemptId: attempt.id },
  };
}
export function advanceSession(state: StudyState, now: number): StudyState {
  const s = state.active;
  if (!s || s.phase !== 'explanation') return state;
  const attempts = state.attempts.map((a) =>
    a.id === s.attemptId ? { ...a, explanationMs: s.phaseMs } : a,
  );
  if (s.index + 1 >= s.questionIds.length)
    return {
      ...state,
      attempts,
      active: null,
      sessions: [
        ...state.sessions,
        {
          id: s.id,
          completedAt: now,
          count: s.questionIds.length,
          elapsedMs: s.elapsedMs,
        },
      ],
    };
  return {
    ...state,
    attempts,
    active: {
      ...s,
      index: s.index + 1,
      phase: 'answer',
      selected: null,
      guess: false,
      hintUsed: false,
      attemptId: null,
      phaseMs: 0,
    },
  };
}
export function conceptStatus(
  state: StudyState,
  id: string,
  now: number,
): string {
  const card = state.reviews[id];
  if (card && (card.needsReview || card.dueAt <= now)) return 'Needs review';
  if (state.attempts.some((a) => a.conceptId === id)) return 'Practicing';
  if (state.visited.includes(id) || state.completed.includes(id))
    return 'Learning';
  return 'Unseen';
}
export function uniqueEvidence(state: StudyState) {
  const seen = new Set<string>();
  return state.attempts.filter((a) => {
    if (seen.has(a.questionId)) return false;
    seen.add(a.questionId);
    return true;
  });
}
const isRecord = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
const finite = (x: unknown) =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0;
export function validateBackup(
  raw: unknown,
  conceptIds: string[],
  questions: { id: string; conceptId: string; correctIndex: number }[],
): StudyState {
  const fail = () => {
    throw new Error(
      'This file is not a valid CISSP Buddy backup. Your current progress is unchanged.',
    );
  };
  if (!isRecord(raw)) return fail();
  const data = 'state' in raw ? raw.state : raw;
  if (!isRecord(data) || data.version !== 1) return fail();
  const ids = new Set(conceptIds),
    qs = new Map(questions.map((q) => [q.id, q]));
  for (const k of ['visited', 'completed']) {
    const arr = data[k];
    if (
      !Array.isArray(arr) ||
      arr.length > conceptIds.length ||
      new Set(arr).size !== arr.length ||
      arr.some((v) => typeof v !== 'string' || !ids.has(v))
    )
      return fail();
  }
  if (
    !Array.isArray(data.attempts) ||
    data.attempts.length > 50000 ||
    !Array.isArray(data.notes) ||
    data.notes.length > 5000 ||
    !Array.isArray(data.sessions) ||
    data.sessions.length > 10000 ||
    !isRecord(data.reviews)
  )
    return fail();
  const attemptIds = new Set<string>();
  for (const a of data.attempts) {
    if (
      !isRecord(a) ||
      typeof a.id !== 'string' ||
      attemptIds.has(a.id) ||
      typeof a.questionId !== 'string' ||
      !qs.has(a.questionId) ||
      qs.get(a.questionId)!.conceptId !== a.conceptId ||
      !Number.isInteger(a.chosen) ||
      Number(a.chosen) < 0 ||
      Number(a.chosen) > 3 ||
      typeof a.correct !== 'boolean' ||
      a.correct !== (a.chosen === qs.get(a.questionId)!.correctIndex) ||
      typeof a.guess !== 'boolean' ||
      (a.hintUsed !== undefined && typeof a.hintUsed !== 'boolean') ||
      (a.contentRelease !== undefined &&
        (typeof a.contentRelease !== 'string' ||
          a.contentRelease.length > 100)) ||
      (a.questionSnapshot !== undefined &&
        (!isRecord(a.questionSnapshot) ||
          typeof a.questionSnapshot.stem !== 'string' ||
          !Array.isArray(a.questionSnapshot.options) ||
          a.questionSnapshot.options.length !== 4 ||
          a.questionSnapshot.options.some((v) => typeof v !== 'string') ||
          !Array.isArray(a.questionSnapshot.explanations) ||
          a.questionSnapshot.explanations.length !== 4 ||
          a.questionSnapshot.explanations.some((v) => typeof v !== 'string') ||
          a.questionSnapshot.correctIndex !==
            qs.get(a.questionId)!.correctIndex)) ||
      typeof a.repeated !== 'boolean' ||
      !finite(a.at) ||
      !finite(a.answerMs) ||
      !finite(a.explanationMs)
    )
      return fail();
    attemptIds.add(a.id);
  }
  for (const [id, c] of Object.entries(data.reviews)) {
    if (
      !ids.has(id) ||
      !isRecord(c) ||
      !finite(c.dueAt) ||
      !finite(c.lastAt) ||
      typeof c.intervalDays !== 'number' ||
      c.intervalDays < 1 ||
      c.intervalDays > 30 ||
      typeof c.needsReview !== 'boolean'
    )
      return fail();
  }
  const noteIds = new Set<string>();
  for (const n of data.notes) {
    if (
      !isRecord(n) ||
      typeof n.id !== 'string' ||
      noteIds.has(n.id) ||
      typeof n.conceptId !== 'string' ||
      !ids.has(n.conceptId) ||
      typeof n.text !== 'string' ||
      n.text.length > 2000 ||
      !finite(n.createdAt)
    )
      return fail();
    noteIds.add(n.id);
  }
  for (const s of data.sessions) {
    if (
      !isRecord(s) ||
      typeof s.id !== 'string' ||
      !finite(s.completedAt) ||
      !Number.isInteger(s.count) ||
      Number(s.count) < 1 ||
      Number(s.count) > 4 ||
      !finite(s.elapsedMs)
    )
      return fail();
  }
  if (data.active !== null) {
    const s = data.active;
    if (
      !isRecord(s) ||
      typeof s.id !== 'string' ||
      !Array.isArray(s.questionIds) ||
      s.questionIds.length < 1 ||
      s.questionIds.length > 4 ||
      new Set(s.questionIds).size !== s.questionIds.length ||
      s.questionIds.some((id) => typeof id !== 'string' || !qs.has(id)) ||
      !Number.isInteger(s.index) ||
      Number(s.index) < 0 ||
      Number(s.index) >= s.questionIds.length ||
      !['answer', 'explanation'].includes(String(s.phase)) ||
      (s.selected !== null &&
        (!Number.isInteger(s.selected) ||
          Number(s.selected) < 0 ||
          Number(s.selected) > 3)) ||
      typeof s.guess !== 'boolean' ||
      (s.hintUsed !== undefined && typeof s.hintUsed !== 'boolean') ||
      !finite(s.elapsedMs) ||
      !finite(s.phaseMs) ||
      Number(s.phaseMs) > Number(s.elapsedMs) ||
      typeof s.label !== 'string' ||
      s.label.length > 120
    )
      return fail();
    if (
      s.phase === 'explanation' &&
      (typeof s.attemptId !== 'string' ||
        !attemptIds.has(s.attemptId) ||
        !(data.attempts as Attempt[]).some(
          (a) =>
            a.id === s.attemptId &&
            a.questionId === (s.questionIds as string[])[Number(s.index)],
        ))
    )
      return fail();
    if (s.phase === 'answer' && s.attemptId !== null) return fail();
  }
  // Return a clean schema, never preserve unknown top-level fields from imported input.
  return JSON.parse(
    JSON.stringify({
      version: 1,
      visited: data.visited,
      completed: data.completed,
      attempts: data.attempts,
      reviews: data.reviews,
      notes: data.notes,
      active: data.active,
      sessions: data.sessions,
    }),
  ) as StudyState;
}
