import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import type { CourseManifest } from '../lib/course/types';
import type { LearnerState } from '../lib/course/learner-state';
import { dueUnits } from '../lib/course/learner-state';
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

  const nextUnanswered = current.actions.find((action) =>
    current.checks.some(
      (check) =>
        check.checkId === action.checkId && check.status === 'unanswered',
    ),
  );
  const reviewRow = (unit: { id: string; title: string }) => (
    <a
      className="review-queue-row"
      href={unitLink(unit.id, 'review')}
      key={unit.id}
    >
      <div>
        <h3>{unit.title}</h3>
        <p>
          {state.reviews[unit.id]?.needsReview
            ? 'Changed retry needed'
            : 'Spaced review due'}
        </p>
      </div>
      <ArrowRight size={20} aria-hidden="true" />
    </a>
  );
  return (
    <>
      <div className="course-page-heading">
        <h1>Practice &amp; review</h1>
      </div>
      {queue.length ? (
        <>
          <div className="section-heading">
            <h2>Reviews</h2>
            <span>{queue.length} due</span>
          </div>
          {queue.slice(0, 5).map(reviewRow)}
          {queue.length > 5 && (
            <details className="practice-more-reviews">
              <summary>More reviews ({queue.length - 5})</summary>
              {queue.slice(5).map(reviewRow)}
            </details>
          )}
        </>
      ) : (
        <div className="course-empty compact">
          <h2>No reviews due.</h2>
          <p>
            {hasCurrentReview
              ? 'Your saved reviews are scheduled for later.'
              : 'Your first answer will create a review record.'}
          </p>
          <a
            className="course-primary"
            href={nextUnanswered ? nextUnanswered.href : '#/curriculum'}
          >
            {nextUnanswered ? nextUnanswered.label : 'Choose a unit'}
            <ArrowRight size={18} aria-hidden="true" />
          </a>
          {nextUnanswered && <p>{nextUnanswered.unitTitle}</p>}
        </div>
      )}
      {children}
      <details className="practice-domains">
        <summary>Practice across domains</summary>
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
      </details>
    </>
  );
}
