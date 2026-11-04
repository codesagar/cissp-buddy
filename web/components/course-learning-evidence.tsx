import type { LearnerState } from '../lib/course/learner-state';
import type { CourseManifest } from '../lib/course/types';
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
}: {
  state: LearnerState;
  manifest: CourseManifest;
  now: number;
  compact?: boolean;
}) {
  const evidence = learningEvidence(state, manifest, now);
  return (
    <section
      className="course-learning-evidence"
      aria-label="Your latest learning evidence"
    >
      <div className="learning-evidence-heading">
        <h2>Your latest learning evidence</h2>
        {compact && <a href="#/practice">Inspect evidence & review</a>}
      </div>
      <p>
        Each named unit check uses its latest saved response. Earlier attempts
        remain in history.
      </p>
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
          <dt>No response yet</dt>
          <dd>
            {evidence.unanswered} / {evidence.totalChecks} checks
          </dd>
        </div>
      </dl>
      {compact && (
        <p className="learning-evidence-scope">
          Unit-check evidence only; connection cases are separate. These counts
          are not a mastery or exam-readiness score.
        </p>
      )}
      {!compact && (
        <>
          <p className="learning-evidence-scope">
            {evidence.repeatedResponses} repeat{' '}
            {evidence.repeatedResponses === 1
              ? 'response remains'
              : 'responses remain'}{' '}
            saved; they do not add new checks. {evidence.unitsDue}{' '}
            {evidence.unitsDue === 1 ? 'unit is' : 'units are'} due for review.
            Review scheduling is separate from the latest-response counts above.
          </p>
          {evidence.actions.length > 0 ? (
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
                  {action.checkId && (
                    <details className="learning-evidence-check">
                      <summary>Which check?</summary>
                      <code>{action.checkId}</code>
                    </details>
                  )}
                  <a href={action.href}>
                    {action.label}
                    <span aria-hidden="true"> →</span>
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p>
              {evidence.totalChecks
                ? 'No review is due right now. Earlier responses remain in the evidence above; your schedule will bring decisions back when due.'
                : 'No directly scoped unit checks are available in this outline. Reading does not create answer evidence.'}
            </p>
          )}
          <details className="learning-evidence-limits">
            <summary>What these counts cover</summary>
            <p>
              {evidence.conceptsWithoutUnitCheck} of{' '}
              {evidence.explainedConcepts} explained concepts have no directly
              scoped unit check. Connection cases may assess some separately;
              their answers stay in each case’s review and are excluded from
              these unit-check counts. Visits record exposure. Repeated familiar
              questions, assisted responses and correct unassisted responses are
              different evidence. These counts do not establish mastery or exam
              readiness.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
