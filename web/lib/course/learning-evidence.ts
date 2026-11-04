import type { CourseAttempt, LearnerState } from './learner-state';
import type { CourseManifest } from './types';

export type LatestCheckEvidence = {
  checkId: string;
  unitId: string;
  unitTitle: string;
  conceptIds: string[];
  kind: CourseAttempt['kind'] | null;
  status: 'unanswered' | 'correct-unassisted' | 'needs-review';
  latest: CourseAttempt | null;
  responses: number;
};
export type EvidenceAction = {
  unitId: string;
  unitTitle: string;
  checkId: string | null;
  kind: CourseAttempt['kind'] | null;
  href: string;
  label: string;
  reason: string;
  latest: CourseAttempt | null;
};
export type LearningEvidence = {
  checks: LatestCheckEvidence[];
  totalChecks: number;
  correctUnassisted: number;
  needsReview: number;
  unanswered: number;
  repeatedResponses: number;
  conceptsWithoutUnitCheck: number;
  explainedConcepts: number;
  unitsDue: number;
  actions: EvidenceAction[];
};

// The generated manifest deliberately lists prediction, transfer, retry in this order.
// No lesson bodies or question wording are downloaded to build this summary.
const checkKinds = ['prediction', 'transfer', 'retry'] as const;
const checkNames = {
  prediction: 'prediction',
  transfer: 'changed case',
  retry: 'changed retry',
};
const sameScope = (left: string[], right: string[]) =>
  left.length === right.length &&
  [...left].sort().every((id, index) => id === [...right].sort()[index]);
const independent = (attempt: CourseAttempt) =>
  attempt.correct &&
  !attempt.guess &&
  !attempt.hintUsed &&
  !attempt.outcomeViewed;

function latestReason(attempt: CourseAttempt): string {
  const reasons = [
    ...(!attempt.correct ? ['was incorrect'] : []),
    ...(attempt.hintUsed ? ['used a hint'] : []),
    ...(attempt.outcomeViewed
      ? ['followed a revealed outcome or explanation']
      : []),
    ...(attempt.guess ? ['was marked uncertain'] : []),
  ];
  return `Your latest ${checkNames[attempt.kind]} response ${reasons.join('; ')}. Inspect the explanation, then try a changed retry.`;
}

/** Latest named-check evidence, derived without changing saved history or scheduling. */
export function learningEvidence(
  state: LearnerState,
  manifest: CourseManifest,
  now: number,
): LearningEvidence {
  const byQuestion = new Map<string, CourseAttempt[]>();
  for (const attempt of state.attempts) {
    const attempts = byQuestion.get(attempt.questionId) || [];
    attempts.push(attempt);
    byQuestion.set(attempt.questionId, attempts);
  }
  const checks = manifest.units.flatMap((unit) =>
    (unit.checks || []).map((check, index): LatestCheckEvidence => {
      const kind = checkKinds[index] || null;
      const attempts = (byQuestion.get(check.id) || []).filter(
        (attempt) =>
          attempt.unitId === unit.id &&
          (!kind || attempt.kind === kind) &&
          attempt.snapshot.id === check.id &&
          sameScope(attempt.conceptIds, check.conceptIds) &&
          sameScope(attempt.snapshot.conceptIds, check.conceptIds),
      );
      const reference =
        state.units[unit.id]?.checks[check.id]?.submittedAttemptId;
      const latest = attempts.reduce<CourseAttempt | null>(
        (selected, attempt) => {
          if (!selected || attempt.at > selected.at) return attempt;
          if (attempt.at !== selected.at) return selected;
          // Current submitted reference resolves a same-time save; IDs resolve all other ties.
          if (attempt.id === reference) return attempt;
          if (selected.id === reference) return selected;
          return attempt.id > selected.id ? attempt : selected;
        },
        null,
      );
      return {
        checkId: check.id,
        unitId: unit.id,
        unitTitle: unit.title,
        conceptIds: check.conceptIds,
        kind,
        status: !latest
          ? 'unanswered'
          : independent(latest)
            ? 'correct-unassisted'
            : 'needs-review',
        latest,
        responses: attempts.length,
      };
    }),
  );
  const actions: EvidenceAction[] = [];
  const unitsDue = manifest.units.filter((unit) => {
    const review = state.reviews[unit.id];
    return (
      (unit.checks || []).length > 0 &&
      review &&
      (review.needsReview || review.dueAt <= now)
    );
  });
  // Curriculum order is predictable. Offer one useful action per unit, at most three.
  for (const unit of manifest.units) {
    const unitChecks = checks.filter((check) => check.unitId === unit.id);
    if (!unitChecks.length) continue;
    const problem = unitChecks.find((check) => check.status === 'needs-review');
    const review = state.reviews[unit.id];
    const due = review && (review.needsReview || review.dueAt <= now);
    // Scheduling owns when a repaired unit returns. A prior named-check miss
    // remains evidence, but must not undo a successful changed retry.
    if (review ? !due : !problem) continue;
    const spaced = !!review && !review.needsReview;
    const latest = spaced ? null : problem?.latest || null;
    const actionCheck = latest
      ? problem
      : unitChecks.find((check) => check.kind === 'retry');
    actions.push({
      unitId: unit.id,
      unitTitle: unit.title,
      checkId: actionCheck?.checkId || null,
      kind: actionCheck?.kind || null,
      href: `#/unit/${encodeURIComponent(unit.id)}/review`,
      label: 'Review this decision',
      reason: spaced
        ? 'A spaced review is due. Revisit the explanation and try the changed retry.'
        : latest
          ? latestReason(latest)
          : review?.needsReview
            ? 'An earlier response still needs a changed retry. A later correct answer to another check does not clear that review need.'
            : 'A spaced review is due. Revisit the explanation and try the changed retry.',
      latest,
    });
    if (actions.length === 3) break;
  }
  if (actions.length < 3) {
    for (const check of checks) {
      if (
        check.status !== 'unanswered' ||
        actions.some((action) => action.unitId === check.unitId)
      )
        continue;
      const stage =
        check.kind === 'prediction'
          ? 'predict'
          : check.kind === 'transfer'
            ? 'transfer'
            : check.kind === 'retry'
              ? 'review'
              : 'understand';
      actions.push({
        unitId: check.unitId,
        unitTitle: check.unitTitle,
        checkId: check.checkId,
        kind: check.kind,
        href: `#/unit/${encodeURIComponent(check.unitId)}/${stage}`,
        label: check.kind
          ? `Try the ${checkNames[check.kind]}`
          : 'Open this unit',
        reason: `No response is saved for this ${check.kind ? checkNames[check.kind] : 'check'}. A lesson visit is separate from answer evidence.`,
        latest: null,
      });
      if (actions.length === 3) break;
    }
  }
  const explained = new Set(manifest.units.flatMap((unit) => unit.conceptIds));
  const assessed = new Set(checks.flatMap((check) => check.conceptIds));
  return {
    checks,
    totalChecks: checks.length,
    correctUnassisted: checks.filter(
      (check) => check.status === 'correct-unassisted',
    ).length,
    needsReview: checks.filter((check) => check.status === 'needs-review')
      .length,
    unanswered: checks.filter((check) => check.status === 'unanswered').length,
    repeatedResponses: checks.reduce(
      (total, check) => total + Math.max(0, check.responses - 1),
      0,
    ),
    conceptsWithoutUnitCheck: [...explained].filter((id) => !assessed.has(id))
      .length,
    explainedConcepts: explained.size,
    unitsDue: unitsDue.length,
    actions,
  };
}
