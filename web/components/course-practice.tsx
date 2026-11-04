import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import type { CourseManifest } from '../lib/course/types';
import type { LearnerState } from '../lib/course/learner-state';
import { courseEvidence, dueUnits } from '../lib/course/learner-state';
import { learningEvidence } from '../lib/course/learning-evidence';
import connectionIndex from '../lib/data/course/connections-index.json' with { type: 'json' };
import {
  sourceHash as packagedSourceHash,
  releaseId as packagedReleaseId,
} from '../lib/data/course/manifest.json' with { type: 'json' };

const unitLink = (id: string, stage: string) => `#/unit/${id}/${stage}`;

/** The generated connection index is summary metadata, never lesson models. */
export function CoursePractice({
  manifest,
  state,
  now,
  children,
}: {
  manifest: CourseManifest;
  state: LearnerState;
  now: number;
  children?: ReactNode;
}) {
  const evidence = courseEvidence(state);
  const current = learningEvidence(state, manifest, now);
  const predictions = new Map(
    current.checks
      .filter((check) => check.kind === 'prediction')
      .map((check) => [check.unitId, check]),
  );
  const titles = new Map(manifest.units.map((unit) => [unit.id, unit.title]));
  if (
    manifest.releaseId === packagedReleaseId &&
    connectionIndex.releaseId === packagedReleaseId &&
    manifest.sourceHash === packagedSourceHash
  )
    for (const connection of connectionIndex.cases)
      titles.set(connection.id, connection.title);
  const queue = dueUnits(state, now).flatMap((id) => {
    const title = titles.get(id);
    return title ? [{ id, title }] : [];
  });
  const hasCurrentReview = Object.keys(state.reviews).some((id) =>
    titles.has(id),
  );

  return (
    <>
      <div className="course-page-heading">
        <h1>Return to the decision that needs work.</h1>
        <p>
          Mistakes, uncertainty and hints bring a unit here. A successful,
          unassisted changed retry schedules it three days ahead; later
          successful reviews extend the interval up to thirty days.
        </p>
      </div>
      <div className="section-heading">
        <h2>Ready to revisit</h2>
        <span>{queue.length} units and cases</span>
      </div>
      {queue.length ? (
        queue.map((unit) => (
          <a
            className="review-queue-row"
            href={unitLink(unit.id, 'review')}
            key={unit.id}
          >
            <div>
              <h3>{unit.title}</h3>
              <p>
                {state.reviews[unit.id]?.needsReview
                  ? 'Repair the relationship, then try a changed case.'
                  : 'A spaced review is due.'}
              </p>
            </div>
            <ArrowRight size={20} />
          </a>
        ))
      ) : (
        <div className="course-empty compact">
          <h2>No units or cases are due now.</h2>
          <p>
            {hasCurrentReview
              ? 'Your saved reviews are scheduled for later. You can revisit any unit in the meantime.'
              : 'Your first answer will create a review record. Choose a unit to begin.'}
          </p>
          <a className="course-primary" href="#/curriculum">
            Choose a unit
            <ArrowRight size={18} />
          </a>
        </div>
      )}
      {children}
      <div className="section-heading">
        <h2>Practice across domains</h2>
        <p>Try an unanswered prediction or revisit your saved evidence.</p>
      </div>
      <div className="practice-domain-list">
        {manifest.domains.map((domain) => {
          const candidates = manifest.units.filter(
            (unit) => unit.domainId === domain.id,
          );
          const unanswered = candidates.find(
            (unit) => predictions.get(unit.id)?.status === 'unanswered',
          );
          const next = unanswered || candidates[0];
          if (!next) return null;
          const hasPrediction = predictions.has(next.id);
          const stage = unanswered
            ? 'predict'
            : hasPrediction
              ? 'review'
              : 'understand';
          const action = unanswered
            ? 'Try an unanswered prediction'
            : hasPrediction
              ? 'Revisit saved evidence'
              : 'Explore this unit';
          return (
            <a key={domain.id} href={unitLink(next.id, stage)}>
              <span>{domain.id}</span>
              <div>
                <h3>{domain.short}</h3>
                <p>{next.title}</p>
                <small>{action}</small>
              </div>
              <ArrowRight size={18} />
            </a>
          );
        })}
      </div>
      <details className="review-evidence">
        <summary>Earlier activity and assessment scope</summary>
        <p>
          {evidence.attempted} distinct questions attempted;{' '}
          {evidence.supportedConcepts} concept labels attached to those
          questions. {evidence.transfers} changed cases attempted, including
          cross-domain cases. Repeats remain in history and do not add distinct
          questions.
        </p>
        <p>
          {current.repeatedResponses} repeated responses to current unit checks
          remain in history. Original answers and their assistance or
          uncertainty flags remain available in each unit’s review; a later
          response does not erase them.
        </p>
        <p>
          {current.unanswered} current unit checks are unanswered.{' '}
          {current.conceptsWithoutUnitCheck} explained concepts have no directly
          scoped unit check (connection cases may assess some separately). These
          are unit-check counts; connection evidence remains in the distinct
          totals and each case’s review. They are not an exam-readiness or
          mastery score.
        </p>
      </details>
    </>
  );
}
