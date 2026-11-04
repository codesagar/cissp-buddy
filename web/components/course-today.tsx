import { ArrowRight } from 'lucide-react';
import type { ConnectionDetail, CourseManifest } from '../lib/course/types';
import type { LearnerState } from '../lib/course/learner-state';
import { dueUnits, recommendCourseUnit } from '../lib/course/learner-state';
import { CourseLearningEvidence } from './course-learning-evidence';

export function CourseToday({
  manifest,
  state,
  now,
  connection,
  connectionError = '',
  retryConnection,
}: {
  manifest: CourseManifest;
  state: LearnerState;
  now: number;
  connection?: ConnectionDetail | null;
  connectionError?: string;
  retryConnection?: () => void;
}) {
  const resumedUnit = manifest.units.find(
    (unit) => unit.id === state.lastUnitId,
  );
  const crossResume = state.lastUnitId?.startsWith('cross-');
  const resumedConnection =
    crossResume && connection?.id === state.lastUnitId ? connection : null;
  const recommendation = recommendCourseUnit(state, manifest);
  const next =
    resumedUnit ||
    (resumedConnection
      ? {
          id: resumedConnection.id,
          title: resumedConnection.title,
          outcome: resumedConnection.model.scenario,
          estimatedMinutes: 15,
        }
      : crossResume
        ? null
        : recommendation?.unit || manifest.units[0]);
  const resuming = !!(resumedUnit || resumedConnection);
  const due = dueUnits(state, now);
  return (
    <>
      <div className="course-page-heading">
        <h1>Today</h1>
      </div>
      {next ? (
        <section
          className="today-feature"
          aria-label={resuming ? 'Resume learning' : 'Start learning'}
        >
          <div>
            <span className="course-meta">
              {resuming ? 'Continue learning' : 'Next unit'} ·{' '}
              {next.estimatedMinutes} min
            </span>
            <h2>{next.title}</h2>
            <p className={resuming ? 'today-preview' : undefined}>
              {next.outcome}
            </p>
            {!resuming && recommendation && (
              <p className="recommendation-reason">{recommendation.reason}</p>
            )}
            <a className="course-primary" href={`#/unit/${next.id}`}>
              {resuming ? 'Resume learning' : 'Start learning'}{' '}
              <ArrowRight size={18} />
            </a>
          </div>
        </section>
      ) : (
        <section
          className="course-notice"
          aria-label="Resume cross-domain case"
        >
          {connectionError ? (
            <>
              <p>{connectionError} Your saved place is unchanged.</p>
              <button className="course-primary" onClick={retryConnection}>
                Try loading your case again
              </button>
              <a href={`#/unit/${state.lastUnitId}`}>Open saved case</a>
            </>
          ) : (
            <output>Opening your saved cross-domain case…</output>
          )}
        </section>
      )}
      {!!due.length && (
        <p className="today-due">
          <a href="#/practice">
            {due.length} {due.length === 1 ? 'unit' : 'units'} ready to review{' '}
            <ArrowRight size={16} />
          </a>
        </p>
      )}
      {resuming && recommendation && recommendation.unit.id !== next?.id && (
        <section className="today-secondary">
          <h2>Next unanswered unit</h2>
          <a href={`#/unit/${recommendation.unit.id}`}>
            {recommendation.unit.title} <ArrowRight size={16} />
          </a>
          <p>{recommendation.reason}</p>
        </section>
      )}
      <CourseLearningEvidence
        manifest={manifest}
        state={state}
        now={now}
        compact
      />
    </>
  );
}
