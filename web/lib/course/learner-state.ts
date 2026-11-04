import { scheduleReview } from '../study-state.ts';
import type { ReviewCard } from '../study-state';
import type { TeachingCheck, TeachingModel } from './types';

export const COURSE_STORAGE_KEY = 'cissp-buddy:course:v1';
export const stages = ['understand', 'predict', 'transfer', 'review'] as const;
export type Stage = (typeof stages)[number];
export type AnswerDraft = {
  selected: string | null;
  guess: boolean;
  hintUsed: boolean;
  outcomeViewed?: boolean;
  submittedAttemptId?: string;
};
export type UnitPosition = {
  stage: Stage;
  step: number;
  variant: string;
  visitedAt: number;
  checks: Record<string, AnswerDraft>;
  note: string;
  exploration?: Record<string, string | boolean>;
};
export type CourseAttempt = {
  id: string;
  unitId: string;
  questionId: string;
  kind: 'prediction' | 'transfer' | 'retry';
  selected: string;
  correct: boolean;
  guess: boolean;
  hintUsed: boolean;
  outcomeViewed?: boolean;
  at: number;
  releaseId: string;
  conceptIds: string[];
  snapshot: TeachingCheck;
};
export type LearnerState = {
  version: 1;
  lastUnitId: string | null;
  units: Record<string, UnitPosition>;
  attempts: CourseAttempt[];
  reviews: Record<string, ReviewCard>;
  preferences: {
    pace: 'step' | 'slow';
    experience: 'new' | 'experienced';
    reducedMotion: boolean;
    theme: 'light' | 'dark';
  };
};
export function emptyLearnerState(): LearnerState {
  return {
    version: 1,
    lastUnitId: null,
    units: {},
    attempts: [],
    reviews: {},
    preferences: {
      pace: 'step',
      experience: 'new',
      reducedMotion: false,
      theme: 'light',
    },
  };
}
export function newPosition(now: number): UnitPosition {
  return {
    stage: 'understand',
    step: 0,
    variant: 'base',
    visitedAt: now,
    checks: {},
    note: '',
  };
}
export const emptyDraft = (): AnswerDraft => ({
  selected: null,
  guess: false,
  hintUsed: false,
});
export function recordCourseAnswer(
  state: LearnerState,
  unitId: string,
  check: TeachingCheck,
  kind: CourseAttempt['kind'],
  releaseId: string,
  now: number,
  id: string,
): LearnerState {
  const position = state.units[unitId] || newPosition(now);
  const draft = position.checks[check.id];
  const option = check.options.find((o) => o.id === draft?.selected);
  if (!draft || !option || draft.submittedAttemptId) return state;
  const attempt: CourseAttempt = {
    id,
    unitId,
    questionId: check.id,
    kind,
    selected: option.id,
    correct: option.correct,
    guess: draft.guess,
    hintUsed: draft.hintUsed,
    outcomeViewed: !!draft.outcomeViewed,
    at: now,
    releaseId,
    conceptIds: check.conceptIds,
    snapshot: structuredClone(check),
  };
  // An unresolved mistake needs a changed retry; viewing a worked answer cannot clear it.
  const pendingRepair = state.reviews[unitId]?.needsReview && kind !== 'retry';
  const review = scheduleReview(
    state.reviews[unitId],
    option.correct && !pendingRepair,
    draft.guess || draft.hintUsed || !!draft.outcomeViewed,
    now,
  );
  return {
    ...state,
    attempts: [...state.attempts, attempt],
    reviews: { ...state.reviews, [unitId]: review },
    units: {
      ...state.units,
      [unitId]: {
        ...position,
        checks: {
          ...position.checks,
          [check.id]: { ...draft, submittedAttemptId: id },
        },
      },
    },
  };
}
export function dueUnits(state: LearnerState, now: number): string[] {
  return Object.entries(state.reviews)
    .filter(([, r]) => r.needsReview || r.dueAt <= now)
    .sort((a, b) => a[1].dueAt - b[1].dueAt)
    .map(([id]) => id);
}
export function courseEvidence(state: LearnerState) {
  return {
    visited: Object.keys(state.units).length,
    attempted: new Set(state.attempts.map((a) => a.questionId)).size,
    transfers: new Set(
      state.attempts.filter((a) => a.kind === 'transfer').map((a) => a.unitId),
    ).size,
    supportedConcepts: new Set(state.attempts.flatMap((a) => a.conceptIds))
      .size,
  };
}

const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
const finite = (x: unknown): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0;
const strings = (x: unknown): x is string[] =>
  Array.isArray(x) && x.every((v) => typeof v === 'string');
const safeKey = (s: string) =>
  s !== '__proto__' && s !== 'constructor' && s !== 'prototype';
function validCheck(c: unknown): c is TeachingCheck {
  if (
    !object(c) ||
    typeof c.id !== 'string' ||
    typeof c.prompt !== 'string' ||
    !strings(c.conceptIds) ||
    typeof c.hint !== 'string' ||
    !Array.isArray(c.options) ||
    c.options.length < 2
  )
    return false;
  return (
    c.options.every(
      (o) =>
        object(o) &&
        typeof o.id === 'string' &&
        typeof o.label === 'string' &&
        typeof o.correct === 'boolean' &&
        typeof o.feedback === 'string' &&
        typeof o.repairStateId === 'string',
    ) && c.options.filter((o) => o.correct).length === 1
  );
}
/** Unknown historical IDs are retained; damaged records are rejected without replacement. */
export function validateLearnerState(input: unknown): LearnerState {
  const fail = () => {
    throw new Error(
      'This course backup is incomplete or damaged. Your current progress has not changed.',
    );
  };
  if (
    !object(input) ||
    input.version !== 1 ||
    !(input.lastUnitId === null || typeof input.lastUnitId === 'string') ||
    !object(input.units) ||
    !Array.isArray(input.attempts) ||
    !object(input.reviews) ||
    !object(input.preferences)
  )
    return fail();
  const p = input.preferences;
  if (
    !['step', 'slow'].includes(String(p.pace)) ||
    !['new', 'experienced'].includes(String(p.experience)) ||
    typeof p.reducedMotion !== 'boolean' ||
    !['light', 'dark'].includes(String(p.theme))
  )
    return fail();
  for (const [key, u] of Object.entries(input.units)) {
    if (
      !safeKey(key) ||
      !object(u) ||
      !stages.includes(u.stage as Stage) ||
      !Number.isInteger(u.step) ||
      !finite(u.step) ||
      typeof u.variant !== 'string' ||
      !finite(u.visitedAt) ||
      typeof u.note !== 'string' ||
      !object(u.checks)
    )
      return fail();
    for (const [id, d] of Object.entries(u.checks))
      if (
        !safeKey(id) ||
        !object(d) ||
        !(d.selected === null || typeof d.selected === 'string') ||
        typeof d.guess !== 'boolean' ||
        typeof d.hintUsed !== 'boolean' ||
        !(
          d.outcomeViewed === undefined || typeof d.outcomeViewed === 'boolean'
        ) ||
        !(
          d.submittedAttemptId === undefined ||
          typeof d.submittedAttemptId === 'string'
        )
      )
        return fail();
    if (
      u.exploration !== undefined &&
      (!object(u.exploration) ||
        Object.entries(u.exploration).some(
          ([k, v]) =>
            !safeKey(k) || !(typeof v === 'string' || typeof v === 'boolean'),
        ))
    )
      return fail();
  }
  const ids = new Set<string>();
  for (const a of input.attempts) {
    if (
      !object(a) ||
      typeof a.id !== 'string' ||
      ids.has(a.id) ||
      typeof a.unitId !== 'string' ||
      typeof a.questionId !== 'string' ||
      !['prediction', 'transfer', 'retry'].includes(String(a.kind)) ||
      typeof a.selected !== 'string' ||
      typeof a.correct !== 'boolean' ||
      typeof a.guess !== 'boolean' ||
      typeof a.hintUsed !== 'boolean' ||
      !(
        a.outcomeViewed === undefined || typeof a.outcomeViewed === 'boolean'
      ) ||
      !finite(a.at) ||
      typeof a.releaseId !== 'string' ||
      !strings(a.conceptIds) ||
      !validCheck(a.snapshot)
    )
      return fail();
    const chosen = a.snapshot.options.find((o) => o.id === a.selected);
    if (
      !chosen ||
      chosen.correct !== a.correct ||
      a.snapshot.id !== a.questionId
    )
      return fail();
    ids.add(a.id);
  }
  for (const [key, r] of Object.entries(input.reviews))
    if (
      !safeKey(key) ||
      !object(r) ||
      !finite(r.dueAt) ||
      !finite(r.lastAt) ||
      !finite(r.intervalDays) ||
      typeof r.needsReview !== 'boolean'
    )
      return fail();
  for (const u of Object.values(input.units))
    for (const d of Object.values((u as UnitPosition).checks))
      if (d.submittedAttemptId && !ids.has(d.submittedAttemptId)) return fail();
  return structuredClone(input) as LearnerState;
}

/** Preserve both stores if one write fails during a combined import. */
export function writeProgressBackup(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  backup: { course?: LearnerState; pilot?: unknown },
) {
  const writes: [string, string][] = [];
  if (backup.course)
    writes.push([COURSE_STORAGE_KEY, JSON.stringify(backup.course)]);
  if (backup.pilot)
    writes.push(['cissp-buddy:v1', JSON.stringify(backup.pilot)]);
  const previous = writes.map(([key]) => [key, storage.getItem(key)] as const);
  try {
    for (const [key, value] of writes) storage.setItem(key, value);
  } catch (error) {
    for (const [key, value] of previous) {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    }
    throw error;
  }
}

export function repairPosition(
  model: TeachingModel,
  stateId: string,
): Pick<UnitPosition, 'step' | 'variant'> {
  const base = model.states.findIndex((s) => s.id === stateId);
  if (base >= 0) return { step: base, variant: 'base' };
  for (const variant of model.variants || []) {
    const step = variant.states.findIndex((s) => s.id === stateId);
    if (step >= 0) return { step, variant: variant.id };
  }
  return { step: 0, variant: 'base' };
}

/** Record answer exposure per check without rewriting already committed evidence. */
export function markViewedOutcomes(
  position: UnitPosition,
  model: TeachingModel,
  variantId: string,
): UnitPosition {
  const variant = model.variants?.find((item) => item.id === variantId);
  const ids = variant
    ? [
        model.transfer.id,
        ...(model.retry.options.some((option) =>
          variant.states.some((state) => state.id === option.repairStateId),
        )
          ? [model.retry.id]
          : []),
      ]
    : [model.prediction.id];
  const checks = { ...position.checks };
  for (const id of ids) {
    const draft = checks[id] || emptyDraft();
    if (!draft.submittedAttemptId)
      checks[id] = { ...draft, outcomeViewed: true };
  }
  return { ...position, checks };
}
