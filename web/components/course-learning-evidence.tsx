import type { LearnerState } from '../lib/course/learner-state';
import type { CourseManifest } from '../lib/course/types';
import { courseEvidence } from '../lib/course/learner-state';
import { learningEvidence } from '../lib/course/learning-evidence';

function ResponseDate({ at }: { at: number }) {
  const date = new Date(at);
  return Number.isFinite(date.getTime()) ? (
    <time dateTime={date.toISOString()}>
      {date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })}
    </time>
  ) : (
    <span>Date unavailable</span>
  );
}

export function CourseLearningEvidence({
  state,
  manifest,
  now,
  compact = false,
  showActions = false,
}: {
  state: LearnerState;
  manifest: CourseManifest;
  now: number;
  compact?: boolean;
  /** Optional check-level actions; Practice already supplies its due queue. */
  showActions?: boolean;
}) {
  const evidence = learningEvidence(state, manifest, now);
  if (compact) {
    if (!state.attempts.length) return null;
    return (
      <p className="learning-evidence-compact">
        <a href="#/practice">
          Learning summary: {evidence.totalChecks - evidence.unanswered} /{' '}
          {evidence.totalChecks} unit checks answered
        </a>
      </p>
    );
  }
  const activity = courseEvidence(state);
  return (
    <details className="course-learning-evidence">
      <summary>Learning summary</summary>
      <dl className="learning-evidence-counts">
        <div>
          <dt>Correct without assistance or uncertainty</dt>
          <dd>
            {evidence.correctUnassisted} / {evidence.totalChecks} checks
          </dd>
        </div>
        <div>
          <dt>Incorrect, assisted or uncertain</dt>
          <dd>
            {evidence.needsReview} / {evidence.totalChecks} checks
          </dd>
        </div>
        <div>
          <dt>Unanswered</dt>
          <dd>
            {evidence.unanswered} / {evidence.totalChecks} checks
          </dd>
        </div>
      </dl>
      <p>
        Each named unit check uses its latest saved response. Earlier attempts
        remain in each unit’s review, including assistance and uncertainty
        flags.
        {` ${evidence.repeatedResponses} repeated responses remain in history.`}
      </p>
      <p>
        Earlier activity: {activity.attempted} distinct questions attempted;{' '}
        {activity.transfers} changed cases attempted, including connection
        cases.
      </p>
      {showActions && evidence.actions.length > 0 && (
        <ol className="learning-evidence-actions">
          {evidence.actions.map((action) => (
            <li key={action.unitId}>
              <h3>{action.unitTitle}</h3>
              <p>{action.reason}</p>
              {action.latest && (
                <p className="learning-evidence-date">
                  Latest response: <ResponseDate at={action.latest.at} />
                  {' · '}
                  {action.latest.correct ? 'Correct' : 'Incorrect'}
                  {action.latest.hintUsed && ' · Hint used'}
                  {action.latest.outcomeViewed &&
                    ' · Outcome or explanation revealed'}
                  {action.latest.guess && ' · Marked uncertain'}
                </p>
              )}
              {action.kind && (
                <p className="learning-evidence-check">
                  {
                    {
                      prediction: 'Prediction',
                      transfer: 'Changed case',
                      retry: 'Changed retry',
                    }[action.kind]
                  }
                </p>
              )}
              <a href={action.href}>{action.label} →</a>
            </li>
          ))}
        </ol>
      )}
      {!evidence.totalChecks && (
        <p>No directly scoped unit checks are available in this outline.</p>
      )}
      <p className="learning-evidence-scope">
        {evidence.conceptsWithoutUnitCheck} of {evidence.explainedConcepts}{' '}
        explained concepts have no directly scoped unit check. Connection cases
        may assess some separately; their answers stay in each case’s review and
        are excluded from these counts. Visits record exposure. These counts do
        not establish mastery or exam readiness.
      </p>
      <p className="learning-evidence-scope">
        Review dates are separate from latest-response counts. Mistakes,
        uncertainty and hints trigger review. A successful unassisted changed
        retry schedules review in three days; later successful reviews extend
        the interval up to thirty days. These intervals are product rules.
      </p>
    </details>
  );
}
