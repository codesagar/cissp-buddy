import { validateLearnerState } from '../course/learner-state.ts';
import type {
  CourseAttempt,
  LearnerState,
  UnitPosition,
} from '../course/learner-state';
import type { Attempt, Note, ReviewCard, StudyState } from '../study-state';

/** Existing state split into ordinary records; no database SDK or provider paths. */
export type CourseRecords = {
  metadata: Omit<LearnerState, 'units' | 'attempts' | 'reviews'>;
  units: {
    id: string;
    position: UnitPosition | null;
    review: ReviewCard | null;
  }[];
  attempts: CourseAttempt[];
};
export type PilotRecords = {
  metadata: Omit<StudyState, 'attempts' | 'reviews' | 'notes' | 'sessions'>;
  attempts: Attempt[];
  reviews: { id: string; value: ReviewCard }[];
  notes: Note[];
  sessions: StudyState['sessions'];
};

const recordError = () =>
  new Error(
    'Saved learning records are incomplete or have duplicate identities.',
  );
function assertRecordIds(rows: { id: string }[]) {
  if (
    !Array.isArray(rows) ||
    rows.some((row) => !row || typeof row.id !== 'string' || !row.id) ||
    new Set(rows.map((row) => row.id)).size !== rows.length
  )
    throw recordError();
}

export function splitCourseState(state: LearnerState): CourseRecords {
  const { units, reviews, attempts, ...metadata } = structuredClone(state);
  return {
    metadata,
    // Historical review dates can exist without a current saved unit position.
    units: [...new Set([...Object.keys(units), ...Object.keys(reviews)])].map(
      (id) => ({
        id,
        position: units[id] ?? null,
        review: reviews[id] ?? null,
      }),
    ),
    attempts,
  };
}

/** Assemble the whole candidate before validation; never invent missing answers. */
export function assembleCourseState(records: CourseRecords): LearnerState {
  assertRecordIds(records.units);
  return validateLearnerState({
    ...records.metadata,
    units: Object.fromEntries(
      records.units
        .filter((record) => record.position !== null)
        .map((record) => [record.id, record.position]),
    ),
    reviews: Object.fromEntries(
      records.units
        .filter((record) => record.review !== null)
        .map((record) => [record.id, record.review]),
    ),
    attempts: records.attempts,
  });
}

export function splitPilotState(state: StudyState): PilotRecords {
  const { attempts, reviews, notes, sessions, ...metadata } =
    structuredClone(state);
  return {
    metadata,
    attempts,
    reviews: Object.entries(reviews).map(([id, value]) => ({ id, value })),
    notes,
    sessions,
  };
}

/** The pilot validator needs the caller's already loaded curriculum identities. */
export function assemblePilotState(
  records: PilotRecords,
  validate: (value: unknown) => StudyState,
): StudyState {
  assertRecordIds(records.reviews);
  return validate({
    ...records.metadata,
    attempts: records.attempts,
    reviews: Object.fromEntries(
      records.reviews.map(({ id, value }) => [id, value]),
    ),
    notes: records.notes,
    sessions: records.sessions,
  });
}

const ordered = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(ordered);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, ordered(child)]),
    );
  return value;
};
const same = (a: unknown, b: unknown) =>
  JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
const historyError = () =>
  new Error(
    'An ordinary account save cannot remove or rewrite previous answers. Keep the original history and use an explicit supported restore flow.',
  );

/** Guard normal saves, not a replacement/import policy or authoritative grading. */
export function assertCourseAnswersPreserved(
  previous: LearnerState,
  next: LearnerState,
) {
  if (previous.attempts === next.attempts) return;
  assertRecordIds(next.attempts);
  const byId = new Map(next.attempts.map((attempt) => [attempt.id, attempt]));
  for (const attempt of previous.attempts)
    if (!same(attempt, byId.get(attempt.id))) throw historyError();
}

/** Existing pilot behavior completes explanation timing after answer submission. */
export function assertPilotAnswersPreserved(
  previous: StudyState,
  next: StudyState,
) {
  if (previous.attempts === next.attempts) return;
  assertRecordIds(next.attempts);
  const withoutTiming = (attempt: Attempt) => {
    const { explanationMs: _explanationMs, ...answer } = attempt;
    return answer;
  };
  const byId = new Map(next.attempts.map((attempt) => [attempt.id, attempt]));
  for (const attempt of previous.attempts) {
    const current = byId.get(attempt.id);
    if (!current || !same(withoutTiming(attempt), withoutTiming(current)))
      throw historyError();
  }
}
