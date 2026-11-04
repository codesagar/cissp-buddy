'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Home,
  Leaf,
  Menu,
  Network,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  CourseManifest,
  ConnectionDetail,
  ConnectionIndex,
  CourseUnit,
  TeachingCheck,
  TeachingModel,
  UnitSummary,
} from '@/lib/course/types';
import {
  dueUnits,
  emptyDraft,
  emptyLearnerState,
  newPosition,
  markViewedOutcomes,
  recordCourseAnswer,
  repairPosition,
  stages,
  validateLearnerState,
} from '@/lib/course/learner-state';
import type {
  AnswerDraft,
  LearnerState,
  Stage,
  UnitPosition,
} from '@/lib/course/learner-state';
import { CourseFigure } from './course-figure';
import { LearnerAccountPanel, useAccount } from '@/lib/learner/account';
import { useLearningDataset } from '@/lib/learner/hooks';
import { CourseLab, hasLab } from './course-labs';
import {
  appUrl,
  loadManifest,
  loadUnit,
  loadConnection,
  loadConnectionsIndex,
} from '@/lib/course/static-loader';
import './course.css';
import { CoursePractice } from './course-practice';
import { CourseToday } from './course-today';
import { CourseLearningEvidence } from './course-learning-evidence';
import './course-learning-evidence.css';

type Setter = Dispatch<SetStateAction<LearnerState>>;
const unitCache = new Map<string, CourseUnit>();
const stageNames = {
  understand: 'Understand',
  predict: 'Predict',
  transfer: 'Transfer',
  review: 'Review',
};
const unitLink = (id: string, stage?: Stage) =>
  `#/unit/${id}${stage ? `/${stage}` : ''}`;
const pretty = (id: string) => id.replaceAll('-', ' ');
function navigate(path: string) {
  window.location.hash = path;
}
function readRoute() {
  return window.location.hash.replace(/^#\/?/, '') || 'today';
}
function useLearner() {
  return useLearningDataset({
    dataset: 'course',
    empty: emptyLearnerState,
    validate: validateLearnerState,
  });
}
export default function CourseApp() {
  const learning = useLearner();
  const account = useAccount();
  const { state, setState, ready, issue } = learning;
  const [manifest, setManifest] = useState<CourseManifest | null>(null);
  const [error, setError] = useState('');
  const [route, setRoute] = useState('today');
  const [menu, setMenu] = useState(false);
  const [now, setNow] = useState(0);
  const [reload, setReload] = useState(0);
  const main = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const firstNavigationLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const update = () => {
      setRoute(readRoute());
      setMenu(false);
    };
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    void Promise.resolve().then(() => setNow(Date.now()));
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    loadManifest(controller.signal)
      .then(setManifest)
      .catch((e) => {
        if (e.name !== 'AbortError')
          setError(
            'The course could not load. Your saved progress is untouched. Check your connection and try again.',
          );
      });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    if (ready) {
      main.current?.focus({ preventScroll: true });
      if (route.split('/').length <= 3)
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [route, ready]);
  useEffect(() => {
    if (!menu) return;
    if (menuButton.current?.getClientRects().length) {
      firstNavigationLink.current?.focus();
    }
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(false);
        if (menuButton.current?.getClientRects().length) {
          menuButton.current.focus();
        }
      }
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [menu]);
  const [page, id, requestedStage, requestedConcept] = route.split('/');
  const currentUnit = manifest?.units.find((u) => u.id === id);
  const domain = currentUnit?.domainId || (page === 'domain' ? Number(id) : 0);
  const due = dueUnits(state, now);
  const closeNavigation = () => {
    if (menu) {
      setMenu(false);
      main.current?.focus({ preventScroll: true });
    }
  };
  const nav = [
    { id: 'today', label: 'Today', Icon: Home },
    { id: 'curriculum', label: 'Curriculum', Icon: BookOpen },
    { id: 'practice', label: 'Practice', Icon: ShieldCheck },
    { id: 'connections', label: 'Connections', Icon: Network },
  ];
  return (
    <div
      className={`course-app ${state.preferences.theme === 'dark' ? 'course-dark' : ''} ${state.preferences.reducedMotion ? 'course-reduced-motion' : ''}`}
    >
      <a
        href="#course-main"
        className="course-skip"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to learning content
      </a>
      <aside
        id="course-navigation"
        className={`course-sidebar ${menu ? 'is-open' : ''}`}
      >
        <a href="#/today" className="course-brand">
          <span className="course-brand-mark">
            <Leaf size={23} />
          </span>
          CISSP <span>buddy</span>
        </a>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <a
              key={n.id}
              ref={n.id === 'today' ? firstNavigationLink : undefined}
              href={`#/${n.id}`}
              onClick={closeNavigation}
              aria-current={page === n.id ? 'page' : undefined}
              aria-label={
                n.id === 'practice' ? 'Practice and review' : undefined
              }
            >
              <n.Icon size={19} aria-hidden="true" />
              {n.label}
              {n.id === 'practice' && due.length > 0 && (
                <span className="nav-count">{due.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="course-domain-nav">
          <h2>Domains</h2>
          {manifest?.domains.map((d) => (
            <a
              href={`#/domain/${d.id}`}
              onClick={closeNavigation}
              key={d.id}
              aria-current={domain === d.id ? 'page' : undefined}
            >
              <span>{d.id}</span>
              {d.short}
            </a>
          ))}
        </div>
        <div className="course-sidebar-bottom">
          <a href="#/backup" onClick={closeNavigation}>
            <ShieldCheck size={18} />
            Settings
          </a>
          {/* oxlint-disable-next-line next/no-html-link-for-pages -- Intentional full-document transition avoids Vinext beta's broken RSC prefetch shim. */}
          <a
            href={appUrl('pilot/')}
            aria-label="Earlier lessons & saved pilot practice"
          >
            Earlier lessons <ArrowRight size={16} />
          </a>
        </div>
      </aside>
      <div
        className="course-workspace"
        onFocusCapture={(event) => {
          if (menu && !menuButton.current?.contains(event.target))
            setMenu(false);
        }}
      >
        <header className="course-topbar">
          <div className="course-mobile-tools">
            <a href="#/today" className="course-brand">
              <Leaf aria-hidden="true" />
              CISSP <span>buddy</span>
            </a>
            <button
              ref={menuButton}
              aria-controls="course-navigation"
              onClick={() => setMenu(!menu)}
              aria-label={menu ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menu}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
          <a
            className="course-topbar-search"
            href="#/curriculum"
            aria-label="Find a concept"
          >
            <Search size={17} aria-hidden="true" /> <span>Find a concept</span>
          </a>
          {page !== 'backup' && (
            <LearnerAccountPanel learning={learning} variant="toolbar" />
          )}
        </header>
        <main id="course-main" className="course-main" ref={main} tabIndex={-1}>
          {page === 'backup' && <LearnerAccountPanel learning={learning} />}
          {issue && (
            <div className="course-notice" role="alert">
              {issue} <a href="#/backup">Account status</a>
            </div>
          )}
          {error ? (
            <div className="course-empty">
              <h1>Your library is taking a moment.</h1>
              <p>{error}</p>
              <button
                className="course-primary"
                onClick={() => (setError(''), setReload((n) => n + 1))}
              >
                Try again
              </button>
            </div>
          ) : !manifest || !ready ? (
            <output className="course-empty">
              <h1>{account.phase === 'guest' ? 'Sign in to learn' : 'Opening your learning space…'}</h1>
              <p>{account.phase === 'guest' ? 'Use Google sign-in above to save and resume your learning.' : 'Bringing in the course outline and your saved place.'}</p>
            </output>
          ) : page === 'unit' ? (
            <UnitView
              key={id}
              id={id}
              manifest={manifest}
              state={state}
              setState={setState}
              requestedStage={requestedStage}
              requestedConcept={requestedConcept}
              now={now}
            />
          ) : page === 'curriculum' || page === 'domain' ? (
            <Curriculum
              manifest={manifest}
              state={state}
              domain={page === 'domain' ? Number(id) : 0}
            />
          ) : page === 'practice' ? (
            <CoursePractice manifest={manifest} state={state} now={now}>
              <CourseLearningEvidence
                manifest={manifest}
                state={state}
                now={now}
              />
            </CoursePractice>
          ) : page === 'backup' ? (
            <Settings
              state={state}
              setState={setState}
            />
          ) : page === 'connections' ? (
            <Connections manifest={manifest} state={state} />
          ) : (
            <Today manifest={manifest} state={state} now={now} />
          )}
        </main>
      </div>
    </div>
  );
}
function Today({
  manifest,
  state,
  now,
}: {
  manifest: CourseManifest;
  state: LearnerState;
  now: number;
}) {
  const [connection, setConnection] = useState<ConnectionDetail | null>(null);
  const [connectionError, setConnectionError] = useState('');
  const [reload, setReload] = useState(0);
  const lastId = state.lastUnitId;
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setConnection(null);
        setConnectionError('');
      }
    });
    if (!lastId?.startsWith('cross-')) return () => controller.abort();
    loadConnection(manifest, lastId, controller.signal)
      .then((payload) => {
        if (!controller.signal.aborted) setConnection(payload);
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.name !== 'AbortError') {
          setConnectionError(error.message);
        }
      });
    return () => controller.abort();
  }, [lastId, manifest, reload]);
  return (
    <CourseToday
      manifest={manifest}
      state={state}
      now={now}
      connection={connection}
      connectionError={connectionError}
      retryConnection={() => setReload((n) => n + 1)}
    />
  );
}
function UnitRow({
  unit,
  state,
  query = '',
}: {
  unit: UnitSummary;
  state: LearnerState;
  query?: string;
}) {
  const attempts = state.attempts.filter((a) => a.unitId === unit.id);
  const status = state.reviews[unit.id]?.needsReview
    ? 'Needs a changed retry'
    : attempts.some((a) => a.kind === 'transfer')
      ? 'Transfer attempted'
      : state.units[unit.id]
        ? 'In progress'
        : '';
  return (
    <div className="course-unit-result">
      <a className="course-unit-row" href={unitLink(unit.id)}>
        <div>
          <span className="course-meta">{unit.estimatedMinutes} min</span>
          <h3>{unit.title}</h3>
        </div>
        <div className="unit-row-status">
          {status && <span>{status}</span>}
          <ChevronRight size={20} />
        </div>
      </a>
      {query.trim() && (
        <div className="matched-concepts">
          {unit.conceptIds
            .map((id, i) => ({
              id,
              label: unit.conceptLabels?.[i] || pretty(id),
            }))
            .filter((c) =>
              `${c.id} ${c.label}`
                .toLowerCase()
                .includes(query.trim().toLowerCase()),
            )
            .map((c) => (
              <a key={c.id} href={`${unitLink(unit.id, 'understand')}/${c.id}`}>
                {c.label}
                <ArrowRight size={14} />
              </a>
            ))}
        </div>
      )}
    </div>
  );
}
function Curriculum({
  manifest,
  state,
  domain,
}: {
  manifest: CourseManifest;
  state: LearnerState;
  domain: number;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const selected = manifest.domains.find((d) => d.id === domain);
  const units = manifest.units.filter(
    (u) =>
      (!domain || u.domainId === domain) &&
      (!query ||
        `${u.title} ${u.summary} ${(u.conceptLabels || []).join(' ')} ${u.conceptIds.map(pretty).join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (filter === 'all' ||
        (filter === 'unvisited'
          ? !state.units[u.id]
          : state.reviews[u.id]?.needsReview)),
  );
  return (
    <>
      <div className="course-breadcrumb">
        <a href="#/today">Today</a>
        <ChevronRight size={16} />
        {selected ? (
          <>
            <a href="#/curriculum">Curriculum</a>
            <ChevronRight size={16} />
            <span>Domain {domain}</span>
          </>
        ) : (
          <span>Curriculum</span>
        )}
      </div>
      <div className="course-page-heading">
        <h1>{selected?.name || 'Curriculum'}</h1>
      </div>
      <div className="course-filters">
        <label className="course-search">
          <Search size={20} />
          <input
            aria-label="Search units and concepts"
            placeholder="Search a unit, concept, or decision…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="course-filter-label">
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All units</option>
            <option value="unvisited">Not visited</option>
            <option value="repair">Needs a retry</option>
          </select>
        </label>
      </div>
      <output className="course-result-count">
        {units.length} {units.length === 1 ? 'unit' : 'units'}
        {query ? ` matching “${query}”` : ''}
      </output>
      {!units.length && (
        <div className="course-empty">
          <h2>No matching units.</h2>
          <p>Try a broader concept or clear the filters.</p>
          <button
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      {manifest.domains
        .filter((d) => units.some((u) => u.domainId === d.id))
        .map((d) => (
          <section className="curriculum-domain" key={d.id}>
            {!domain && (
              <h2>
                <span>{String(d.id).padStart(2, '0')}</span>
                {d.name}
              </h2>
            )}
            <div>
              {units
                .filter((u) => u.domainId === d.id)
                .map((u) => (
                  <UnitRow key={u.id} unit={u} state={state} query={query} />
                ))}
            </div>
          </section>
        ))}
    </>
  );
}
function UnitView({
  id,
  manifest,
  state,
  setState,
  requestedStage,
  requestedConcept,
  now,
}: {
  id: string;
  manifest: CourseManifest;
  state: LearnerState;
  setState: Setter;
  requestedStage?: string;
  requestedConcept?: string;
  now: number;
}) {
  const [connection, setConnection] = useState<ConnectionDetail | null>(null);
  const isConnection = id.startsWith('cross-');
  const [unit, setUnit] = useState<CourseUnit | null>(null),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0);
  const position = state.units[id] || newPosition(now);
  const stage = stages.includes(requestedStage as Stage)
    ? (requestedStage as Stage)
    : position.stage;
  const update = useCallback(
    (patch: Partial<UnitPosition>) =>
      setState((s) => {
        const previous = s.units[id] || newPosition(Date.now());
        const merged = { ...previous, ...patch };
        const model = unit?.id === id ? unit.teaching : null;
        const displayingOutcome =
          model &&
          (patch.exploration?.workedOutcomeVisible === true ||
            (('step' in patch || 'variant' in patch) &&
              (previous.exploration?.workedOutcomeVisible ||
                previous.checks[model.prediction.id]?.submittedAttemptId)));
        return {
          ...s,
          lastUnitId: id,
          units: {
            ...s.units,
            [id]: displayingOutcome
              ? markViewedOutcomes(merged, model, merged.variant)
              : merged,
          },
        };
      }),
    [id, setState, unit],
  );
  useEffect(() => {
    const key = `${manifest.releaseId}/${id}`,
      cached = unitCache.get(key);
    if (cached && !isConnection) {
      void Promise.resolve().then(() => setUnit(cached));
      return;
    }
    const controller = new AbortController();
    (isConnection
      ? loadConnection(manifest, id, controller.signal)
      : loadUnit(manifest, id, controller.signal)
    )
      .then((payload: CourseUnit | ConnectionDetail) => {
        let u: CourseUnit;
        if ('model' in payload) {
          setConnection(payload);
          const concepts = [
            ...new Set(payload.model.nodes.flatMap((n) => n.conceptIds)),
          ];
          u = {
            id: payload.id,
            title: payload.title,
            domainId: 0,
            objectiveIds: [],
            summary: payload.model.focalRelation,
            outcome: payload.model.takeaway,
            conceptIds: concepts,
            prerequisites: [],
            estimatedMinutes: 15,
            sections: [],
            workedExamples: [],
            misconceptions: [],
            sourceRefs: [],
            concepts: [],
            teaching: payload.model,
            releaseId: payload.releaseId,
            sourceHash: manifest.sourceHash,
            sourcePath: `web/lib/data/connections/${payload.id}.json`,
          };
        } else u = payload;
        unitCache.set(key, u);
        setUnit(u);
      })
      .catch((e) => {
        if (e.name !== 'AbortError')
          setError(
            `${e.message} Your progress is safe. Retry, or reload the course outline for the current release.`,
          );
      });
    return () => controller.abort();
  }, [id, manifest, reload, isConnection]);
  useEffect(() => {
    if (unit?.id === id && !error) update({ stage });
  }, [stage, update, id, unit, error]);
  useEffect(() => {
    if (
      !requestedConcept ||
      !unit?.concepts.some((c) => c.id === requestedConcept)
    )
      return;
    document
      .getElementById(`concept-${requestedConcept}`)
      ?.scrollIntoView({ block: 'start' });
    document
      .getElementById(`concept-${requestedConcept}`)
      ?.focus({ preventScroll: true });
  }, [requestedConcept, unit]);
  if (error)
    return (
      <div className="course-empty">
        <h1>Let’s reconnect to this lesson.</h1>
        <p>{error}</p>
        <button onClick={() => (setError(''), setReload((n) => n + 1))}>
          Try lesson again
        </button>
        <button onClick={() => window.location.reload()}>
          Reload course outline
        </button>
      </div>
    );
  if (!unit)
    return (
      <output className="course-empty">Opening this learning unit…</output>
    );
  const model = unit.teaching;
  const goStage = (next: Stage) => {
    update({ stage: next });
    navigate(unitLink(id, next).slice(1));
  };
  const domain = manifest.domains.find((d) => d.id === unit.domainId);
  return (
    <>
      <div className="course-breadcrumb">
        <a href="#/curriculum">Curriculum</a>
        <ChevronRight size={16} />
        <a href={isConnection ? '#/connections' : `#/domain/${unit.domainId}`}>
          {isConnection ? 'Cross-domain cases' : domain?.short}
        </a>
        <ChevronRight size={16} />
        <span>
          {isConnection
            ? 'Linked reasoning'
            : `Objective ${unit.objectiveIds.join(', ')}`}
        </span>
      </div>
      <div className="unit-heading">
        <h1>{unit.title}</h1>
        <details className="unit-outcome">
          <summary>
            Learning goal · {unit.estimatedMinutes} minutes, at your pace
          </summary>
          <p>{unit.outcome}</p>
          {model && <p>{model.question}</p>}
        </details>
      </div>
      <nav className="learning-stages" aria-label="Learning stages">
        {stages.map((s, i) => (
          <button
            key={s}
            onClick={() => goStage(s)}
            aria-current={stage === s ? 'step' : undefined}
          >
            <span>{i + 1}</span>
            {stageNames[s]}
          </button>
        ))}
      </nav>
      {!model ? (
        <div className="course-notice">
          <h2>The source lesson is available.</h2>
          <p>
            The authored guided case is being integrated. Read the explanation
            and concept reference below.
          </p>
        </div>
      ) : stage === 'understand' ? (
        <Understanding
          model={model}
          position={position}
          update={update}
          preferences={state.preferences}
          setState={setState}
          predictionAnswered={
            !!position.checks[model.prediction.id]?.submittedAttemptId
          }
          onPredict={() => goStage('predict')}
        />
      ) : stage === 'predict' || stage === 'transfer' ? (
        <Assessment
          key={`${id}-${stage}`}
          unit={unit}
          check={stage === 'predict' ? model.prediction : model.transfer}
          kind={stage === 'predict' ? 'prediction' : 'transfer'}
          state={state}
          setState={setState}
          onRepair={(repair) => {
            update({
              ...repairPosition(model, repair),
              exploration: {
                ...position.exploration,
                workedOutcomeVisible: true,
                ...(hasLab(model.unitId) ? { teachingView: 'worked' } : {}),
              },
            });
            goStage('understand');
          }}
          onNext={() => goStage(stage === 'predict' ? 'transfer' : 'review')}
        />
      ) : (
        <UnitReview
          unit={unit}
          state={state}
          setState={setState}
          now={now}
          onRepair={(repair) => {
            update({
              ...repairPosition(model, repair),
              exploration: {
                ...position.exploration,
                workedOutcomeVisible: true,
                ...(hasLab(model.unitId) ? { teachingView: 'worked' } : {}),
              },
            });
            goStage('understand');
          }}
        />
      )}
      {stage === 'understand' &&
        model &&
        (!!position.checks[model.prediction.id]?.submittedAttemptId ||
          !!position.exploration?.workedOutcomeVisible ||
          position.step > 0) && (
          <div className="stage-next">
            <button
              className="course-primary"
              onClick={() => goStage('predict')}
            >
              Make a prediction
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      {connection && (
        <section className="connection-sources" id="connection-source-ideas">
          <h2>Return to the source ideas</h2>
          <p>
            This bounded case teaches {connection.relationshipIds.length}{' '}
            assigned{' '}
            {connection.relationshipIds.length === 1
              ? 'relationship'
              : 'relationships'}
            . Its concepts retain the explanations and source context in these
            units.
          </p>
          {connection.unitIds.map((sourceId) => {
            const summary = manifest.units.find((u) => u.id === sourceId)!;
            return (
              <details key={sourceId}>
                <summary>{summary.title}</summary>
                <a href={unitLink(sourceId)}>
                  Open the complete unit <ArrowRight size={14} />
                </a>
                <ul>
                  {summary.conceptIds.map((conceptId, i) => (
                    <li key={conceptId}>
                      <a
                        href={`${unitLink(sourceId, 'understand')}/${conceptId}`}
                      >
                        {summary.conceptLabels?.[i] || pretty(conceptId)}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </section>
      )}
      {!isConnection && (
        <details
          className="course-reference"
          open={!model || !!requestedConcept}
        >
          <summary>
            Go deeper: explanation, {unit.concepts.length} concepts & sources
          </summary>
          <div className="course-reading">
            <h2>The controlling idea</h2>
            <p>{unit.summary}</p>
            {unit.workedExamples.map((e, i) => (
              <section key={i}>
                <h3>{e.title}</h3>
                <p>{e.situation}</p>
                <p>
                  <strong>Reasoning.</strong> {e.reasoning}
                </p>
                <p>{e.takeaway}</p>
              </section>
            ))}
            {unit.sections.map((s) => (
              <section key={s.id} id={`section-${s.id}`}>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <ul>
                  {s.keyPoints.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </section>
            ))}
            <h2>Concepts in this unit</h2>
            <p>
              Each explanation retains its source context. A question assesses
              only the concepts named with that question.
            </p>
            {unit.concepts.map((c) => (
              <article
                className="concept-reference"
                id={`concept-${c.id}`}
                tabIndex={-1}
                key={c.id}
              >
                <h3>{c.label}</h3>
                <p>{c.definition}</p>
                <p>
                  <strong>Decision cue.</strong> {c.decision}
                </p>
                <p>
                  <strong>Watch for.</strong> {c.failureExample}
                </p>
                <small>
                  Source reference: {c.sourceVisualId} ·{' '}
                  {c.sourceRefIds.join(', ')}
                </small>
              </article>
            ))}
            <h2>Sources & scope</h2>
            <p>
              Original teaching examples grounded in the source curriculum.
              Independent AI review is not human expert endorsement or official
              ISC2 training.
            </p>
            <ul>
              {unit.sourceRefs.map((s) => (
                <li key={s.id}>
                  <strong>{s.sourceId}</strong> ·{' '}
                  {Object.values(s.locator)
                    .filter((v) => typeof v === 'string')
                    .join(' · ')}
                </li>
              ))}
            </ul>
            <small>
              Source: {unit.sourcePath}
              <br />
              Release: {unit.releaseId}
              <br />
              Source fingerprint: {unit.sourceHash}
            </small>
          </div>
        </details>
      )}
      <div className="unit-bottom-nav">
        <a href={isConnection ? '#/connections' : `#/domain/${unit.domainId}`}>
          <ArrowLeft size={18} />
          Back to {isConnection ? 'Connections' : domain?.short}
        </a>
        <a href="#/practice">
          Your practice & review
          <ArrowRight size={18} />
        </a>
      </div>
    </>
  );
}
function Understanding({
  model,
  position,
  update,
  preferences,
  setState,
  predictionAnswered,
  onPredict,
}: {
  model: TeachingModel;
  position: UnitPosition;
  update: (patch: Partial<UnitPosition>) => void;
  preferences: LearnerState['preferences'];
  setState: Setter;
  predictionAnswered: boolean;
  onPredict: () => void;
}) {
  const lab = hasLab(model.unitId);
  const guided =
    !lab ||
    position.exploration?.teachingView !== 'explore' ||
    (!predictionAnswered && !position.exploration?.workedOutcomeVisible);
  const variant = model.variants?.find((v) => v.id === position.variant);
  const effectiveModel = variant
    ? {
        ...model,
        nodes: variant.nodes || model.nodes,
        edges: variant.edges || model.edges,
        lanes: variant.lanes || model.lanes,
        matrix: variant.matrix || model.matrix,
        evidenceRecord: variant.evidenceRecord || model.evidenceRecord,
        spatialPlan: variant.spatialPlan || model.spatialPlan,
        quantitative: variant.quantitative || model.quantitative,
      }
    : model;
  const states = variant?.states || model.states;
  const step = Math.min(position.step, states.length - 1);
  const current = states[step];
  const checkpoint =
    !predictionAnswered &&
    !position.exploration?.workedOutcomeVisible &&
    step === 0;
  const unlock = () =>
    update({
      exploration: { ...position.exploration, workedOutcomeVisible: true },
    });
  const [playing, setPlaying] = useState(false),
    [complete, setComplete] = useState(false),
    [systemReduced, setSystemReduced] = useState(false);
  const reduced = preferences.reducedMotion || systemReduced;
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => {
      setSystemReduced(media.matches);
      if (media.matches) setPlaying(false);
    };
    changed();
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    const blur = () => setPlaying(false);
    document.addEventListener('visibilitychange', pause);
    window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('visibilitychange', pause);
      window.removeEventListener('blur', blur);
    };
  }, []);
  useEffect(() => {
    if (!playing || reduced) return;
    if (step >= states.length - 1) return;
    const timer = setTimeout(
      () => {
        update({ step: step + 1 });
        if (step + 1 >= states.length - 1) setPlaying(false);
      },
      preferences.pace === 'slow' ? 9000 : 5500,
    );
    return () => clearTimeout(timer);
  }, [playing, reduced, step, states.length, preferences.pace, update]);
  const move = (n: number) => {
    setPlaying(false);
    update({ step: Math.max(0, Math.min(states.length - 1, n)) });
  };
  return (
    <div className="worked-learning">
      <div className="case-introduction">
        {guided && <p>{model.scenario}</p>}
      </div>
      {lab && (
        <fieldset className="teaching-view-choice">
          <legend className="sr-only">Learning view</legend>
          <button
            aria-pressed={!guided}
            onClick={() => {
              setPlaying(false);
              update({
                exploration: {
                  ...position.exploration,
                  teachingView: 'explore',
                  workedOutcomeVisible: true,
                },
              });
            }}
          >
            Explore inputs · reveal outcomes
          </button>
          <button
            aria-pressed={guided}
            onClick={() => {
              setPlaying(false);
              update({
                exploration: {
                  ...position.exploration,
                  teachingView: 'worked',
                },
              });
            }}
          >
            Follow worked case
          </button>
        </fieldset>
      )}
      {guided && variant && (
        <p className="current-case-change">
          <strong>Changed fact.</strong> {variant.changedFact}
        </p>
      )}
      {guided && (
        <aside className="mobile-case-context" aria-label="Worked-case facts">
          <p>{model.scenario}</p>
        </aside>
      )}
      {!guided ? (
        <CourseLab unitId={model.unitId} position={position} update={update} />
      ) : (
        <CourseFigure
          model={effectiveModel}
          state={current}
          complete={complete}
          beforePrediction={checkpoint}
        />
      )}
      {guided && (
        <>
          {checkpoint && (
            <aside className="prediction-checkpoint">
              <h3>{model.prediction.prompt}</h3>
              <div>
                <button className="course-primary" onClick={onPredict}>
                  Make my prediction
                </button>
                <button
                  onClick={() => {
                    unlock();
                    move(1);
                  }}
                >
                  Continue explanation
                </button>
              </div>
              <small>
                Continuing records no answer and no practice evidence.
              </small>
            </aside>
          )}
          {!checkpoint && (
            <>
              {model.variants?.length && (
                <div className="scenario-selector">
                  <label htmlFor={`variant-${model.unitId}`}>
                    Change one fact
                  </label>
                  <select
                    id={`variant-${model.unitId}`}
                    disabled={checkpoint}
                    value={variant?.id || 'base'}
                    onChange={(e) => {
                      setPlaying(false);
                      update({ variant: e.target.value, step: 0 });
                    }}
                  >
                    <option value="base">Worked case</option>
                    {model.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  {variant && <p>{variant.changedFact}</p>}
                </div>
              )}
              <div
                className="guided-caption"
                aria-live="polite"
                aria-atomic="true"
              >
                <span>
                  {step + 1} / {states.length}
                </span>
                <div>
                  <h3>
                    {checkpoint
                      ? 'Case facts'
                      : `${lab ? 'Worked case: ' : ''}${current.title}`}
                  </h3>
                  <p>
                    {checkpoint ? 'Outcome not revealed.' : current.caption}
                  </p>
                </div>
              </div>
              <div className="teaching-controls">
                <div>
                  <button
                    onClick={() => move(step - 1)}
                    disabled={step === 0}
                    aria-label="Previous explanation step"
                  >
                    <ArrowLeft size={18} />
                    Previous
                  </button>
                  <button
                    onClick={() => move(step + 1)}
                    disabled={checkpoint || step === states.length - 1}
                  >
                    Next
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
              <details className="playback-options">
                <summary>Playback options</summary>
                <div className="teaching-controls">
                  <div>
                    <button
                      onClick={() => {
                        setPlaying(false);
                        update({ step: 0 });
                      }}
                      aria-label="Replay explanation from the beginning"
                    >
                      <RotateCcw size={17} />
                      Replay
                    </button>
                    {!reduced && (
                      <button
                        disabled={checkpoint}
                        onClick={() => {
                          if (step === states.length - 1) update({ step: 0 });
                          setPlaying(!playing);
                        }}
                      >
                        {playing ? <Pause size={17} /> : <Play size={17} />}{' '}
                        {playing ? 'Pause' : 'Play'}
                      </button>
                    )}
                  </div>
                </div>
                <label className="playback-pace">
                  Pace
                  <select
                    value={preferences.pace}
                    onChange={(event) => {
                      setPlaying(false);
                      setState((state) => ({
                        ...state,
                        preferences: {
                          ...state.preferences,
                          pace: event.target.value as 'step' | 'slow',
                        },
                      }));
                    }}
                  >
                    <option value="step">Standard</option>
                    <option value="slow">Slow</option>
                  </select>
                </label>
                <p className="control-note">
                  {reduced
                    ? 'Reduced motion is on. Every step remains available manually.'
                    : 'Starts paused. Playback paces the explanation; it does not represent elapsed system time.'}{' '}
                  Your answers stay saved when you replay.
                </p>
              </details>
            </>
          )}
          <button
            className="text-button"
            onClick={() => {
              setPlaying(false);
              if (checkpoint) unlock();
              setComplete(!complete);
            }}
            aria-expanded={complete}
          >
            {complete
              ? 'Return to focused steps'
              : 'Read the complete static explanation'}
          </button>
          {complete && (
            <ol className="static-explanation">
              {states.map((s) => (
                <li key={s.id}>
                  <h3>{s.title}</h3>
                  <p>{s.caption}</p>
                </li>
              ))}
            </ol>
          )}
          <details className="case-assumptions">
            <summary>Assumptions & limits of this case</summary>
            <ul>
              {model.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
function Assessment({
  unit,
  check,
  kind,
  state,
  setState,
  onRepair,
  onNext,
}: {
  unit: CourseUnit;
  check: TeachingCheck;
  kind: 'prediction' | 'transfer' | 'retry';
  state: LearnerState;
  setState: Setter;
  onRepair: (id: string) => void;
  onNext?: () => void;
}) {
  const position = state.units[unit.id] || newPosition(0);
  const draft = position.checks[check.id] || emptyDraft();
  const attempt = state.attempts.find((a) => a.id === draft.submittedAttemptId);
  const displayedCheck = attempt?.snapshot || check;
  const chosen = displayedCheck.options.find(
    (o) => o.id === (attempt?.selected || draft.selected),
  );
  function setDraft(patch: Partial<AnswerDraft>) {
    setState((s) => {
      const pos = s.units[unit.id] || newPosition(Date.now());
      return {
        ...s,
        units: {
          ...s.units,
          [unit.id]: {
            ...pos,
            checks: {
              ...pos.checks,
              [check.id]: {
                ...(pos.checks[check.id] || emptyDraft()),
                ...patch,
              },
            },
          },
        },
      };
    });
  }
  return (
    <section className="assessment" aria-labelledby={`check-${check.id}`}>
      <div className="assessment-heading">
        <span className="course-meta">
          {kind === 'prediction'
            ? 'Prediction'
            : kind === 'transfer'
              ? 'A changed case'
              : 'A different retry'}{' '}
          · no time limit
        </span>
        <h2 id={`check-${check.id}`}>{displayedCheck.prompt}</h2>
        {kind === 'prediction' && (
          <p className="assessment-context">{unit.teaching?.scenario}</p>
        )}
        <p>Choose the response best supported by the stated facts.</p>
        {draft.outcomeViewed && !attempt && (
          <p className="assessment-hint">
            Assisted: outcome or explanation viewed before this answer. Your
            response will remain available for review.
          </p>
        )}
      </div>
      <fieldset disabled={!!attempt}>
        <legend className="sr-only">Choose your answer</legend>
        {displayedCheck.options.map((o, i) => (
          <label
            key={o.id}
            className={`assessment-option ${(attempt?.selected || draft.selected) === o.id ? 'is-selected' : ''}`}
          >
            <input
              type="radio"
              name={check.id}
              value={o.id}
              checked={(attempt?.selected || draft.selected) === o.id}
              onChange={() => setDraft({ selected: o.id })}
            />
            <span className="option-letter" aria-hidden="true">
              {String.fromCharCode(65 + i)}
            </span>
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>
      {!attempt ? (
        <>
          <div className="assessment-tools">
            <label>
              <input
                type="checkbox"
                checked={draft.guess}
                onChange={(e) => setDraft({ guess: e.target.checked })}
              />
              I’m guessing or uncertain
            </label>
            <button
              className="text-button"
              onClick={() => setDraft({ hintUsed: true })}
              disabled={draft.hintUsed}
            >
              Show a hint
            </button>
          </div>
          {draft.hintUsed && <p className="assessment-hint">{check.hint}</p>}
          <button
            className="course-primary"
            disabled={!chosen}
            onClick={() =>
              setState((s) =>
                recordCourseAnswer(
                  s,
                  unit.id,
                  check,
                  kind,
                  unit.releaseId,
                  Date.now(),
                  crypto.randomUUID(),
                ),
              )
            }
          >
            Check my reasoning
            <ArrowRight size={18} />
          </button>
        </>
      ) : (
        <output
          className={`assessment-feedback ${attempt.correct ? 'is-correct' : 'needs-repair'}`}
        >
          <h3>
            {attempt.correct
              ? 'That decision is supported.'
              : 'Revisit the controlling relationship.'}
          </h3>
          <p>{chosen?.feedback}</p>
          {attempt.releaseId !== unit.releaseId && (
            <p>
              This saved answer retains its original question and feedback from{' '}
              {attempt.releaseId}.
            </p>
          )}
          {(attempt.outcomeViewed || attempt.guess || attempt.hintUsed) && (
            <p>
              {[
                attempt.outcomeViewed &&
                  'Outcome or explanation viewed before answering',
                attempt.hintUsed && 'Hint used',
                attempt.guess && 'Uncertainty recorded',
              ]
                .filter(Boolean)
                .join(' · ')}
              {'. This unit remains ready for review.'}
            </p>
          )}
          <div className="feedback-actions">
            <button onClick={() => onRepair(chosen?.repairStateId || '')}>
              Inspect the relevant explanation
            </button>
            {onNext && (
              <button className="course-primary" onClick={onNext}>
                {kind === 'prediction'
                  ? 'Try the changed case'
                  : 'Review your evidence'}
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </output>
      )}
      <details className="assessment-scope">
        <summary>What this question checks</summary>
        <ul>
          {check.conceptIds.map((id) => (
            <li key={id}>
              <a
                href={
                  unit.id.startsWith('cross-')
                    ? unitLink(unit.id, 'understand')
                    : `${unitLink(unit.id, 'understand')}/${id}`
                }
                onClick={
                  unit.id.startsWith('cross-')
                    ? (event) => {
                        event.preventDefault();
                        document
                          .getElementById('connection-source-ideas')
                          ?.scrollIntoView();
                      }
                    : undefined
                }
              >
                {unit.concepts.find((c) => c.id === id)?.label || pretty(id)}
              </a>
            </li>
          ))}
        </ul>
        <p>
          One response is evidence about this case; it does not establish
          mastery of the whole unit.
        </p>
      </details>
    </section>
  );
}
function UnitReview({
  unit,
  state,
  setState,
  now,
  onRepair,
}: {
  unit: CourseUnit;
  state: LearnerState;
  setState: Setter;
  now: number;
  onRepair: (id: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(!!state.units[unit.id]?.note);
  const model = unit.teaching!,
    attempts = state.attempts.filter((a) => a.unitId === unit.id),
    review = state.reviews[unit.id],
    questionCount = new Set(attempts.map((a) => a.questionId)).size,
    repairCount = attempts.filter(
      (a) => !a.correct || a.guess || a.hintUsed || a.outcomeViewed,
    ).length;
  return (
    <div className="unit-review">
      <h2>Keep the relationship, not just the answer.</h2>
      <p className="review-takeaway">{model.takeaway}</p>
      <div className="review-evidence">
        <h3>Your evidence for this unit</h3>
        <p>
          {attempts.length
            ? `${questionCount} distinct ${questionCount === 1 ? 'question' : 'questions'} attempted. ${repairCount} ${repairCount === 1 ? 'response' : 'responses'} included a mistake, uncertainty, or assistance.`
            : 'No answers recorded yet. Reading and stepping are saved separately from practice evidence.'}
        </p>
        <p>
          {!review
            ? 'Answer a prediction or changed case to start your review schedule.'
            : review.needsReview || review.dueAt <= now
              ? 'Ready to review now. Use the explanation, then try the different case below.'
              : `Next review: ${new Date(review.dueAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}. You can practice earlier.`}
        </p>
      </div>
      <details
        className="course-note-disclosure"
        open={noteOpen}
        onToggle={(event) => setNoteOpen(event.currentTarget.open)}
      >
        <summary>
          Your notes{state.units[unit.id]?.note ? ' · saved note' : ''}
        </summary>
        <label className="course-note">
          Explain the idea in your own words
          <textarea
            maxLength={4000}
            value={state.units[unit.id]?.note || ''}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                units: {
                  ...s.units,
                  [unit.id]: {
                    ...(s.units[unit.id] || newPosition(Date.now())),
                    note: e.target.value,
                  },
                },
              }))
            }
            placeholder="Which fact controls the decision? What would change your answer?"
          />
        </label>
      </details>
      <Assessment
        unit={unit}
        check={model.retry}
        kind="retry"
        state={state}
        setState={setState}
        onRepair={onRepair}
      />
      {state.units[unit.id]?.checks[model.retry.id]?.submittedAttemptId && (
        <button
          className="text-button"
          onClick={() =>
            setState((s) => {
              const pos = s.units[unit.id];
              return {
                ...s,
                units: {
                  ...s.units,
                  [unit.id]: {
                    ...pos,
                    checks: { ...pos.checks, [model.retry.id]: emptyDraft() },
                  },
                },
              };
            })
          }
        >
          Repeat this retry later (previous attempt stays saved)
        </button>
      )}
      <details className="course-reference">
        <summary>Inspect your saved attempts</summary>
        {attempts.map((a) => (
          <article className="saved-attempt" key={a.id}>
            <h3>{a.snapshot.prompt}</h3>
            <p>
              Your answer:{' '}
              {a.snapshot.options.find((o) => o.id === a.selected)?.label}
            </p>
            <p>
              {a.correct ? 'Supported' : 'Needs repair'} ·{' '}
              {a.guess ? 'Uncertain' : 'No uncertainty flag'} ·{' '}
              {a.hintUsed ? 'Hint used' : 'No hint used'}
              {a.outcomeViewed
                ? ' · Assisted: outcome or explanation viewed before answer'
                : ''}
            </p>
            <small>
              {new Date(a.at).toLocaleString()} · {a.releaseId}
            </small>
          </article>
        ))}
      </details>
    </div>
  );
}
function Settings({ state, setState }: { state: LearnerState; setState: Setter }) {
  return (
    <>
      <div className="course-page-heading"><h1>Settings</h1></div>
      <section className="settings-section">
        <h2>Make the pace yours</h2>
        <div className="preference-fields">
          <label>
            Experience
            <select
              value={state.preferences.experience}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  preferences: {
                    ...s.preferences,
                    experience: e.target.value as 'new' | 'experienced',
                  },
                }))
              }
            >
              <option value="new">New to this material</option>
              <option value="experienced">Returning / experienced</option>
            </select>
          </label>
          <label>
            Explanation pace
            <select
              value={state.preferences.pace}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  preferences: {
                    ...s.preferences,
                    pace: e.target.value as 'step' | 'slow',
                  },
                }))
              }
            >
              <option value="step">Standard</option>
              <option value="slow">Slow</option>
            </select>
          </label>
          <label>
            Appearance
            <select
              value={state.preferences.theme}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  preferences: {
                    ...s.preferences,
                    theme: e.target.value as 'light' | 'dark',
                  },
                }))
              }
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="checkbox-preference">
            <input
              type="checkbox"
              checked={state.preferences.reducedMotion}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  preferences: {
                    ...s.preferences,
                    reducedMotion: e.target.checked,
                  },
                }))
              }
            />
            Use manual steps with reduced motion
          </label>
        </div>
        <p>
          Changing these preferences preserves your position and answers. Every
          lesson starts paused.
        </p>
      </section>
    </>
  );
}

function Connections({
  manifest,
  state,
}: {
  manifest: CourseManifest;
  state: LearnerState;
}) {
  const [index, setIndex] = useState<ConnectionIndex | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadConnectionsIndex(manifest, controller.signal)
      .then(setIndex)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [manifest, reload]);
  return (
    <>
      <div className="course-page-heading">
        <h1>Connections</h1>
      </div>
      {error ? (
        <div className="course-notice" role="alert">
          <p>{error} Your saved work is untouched.</p>
          <button onClick={() => window.location.reload()}>
            Reload course outline
          </button>
          <button
            onClick={() => {
              setError('');
              setReload((n) => n + 1);
            }}
          >
            Try cases again
          </button>
        </div>
      ) : !index ? (
        <output>Opening the linked cases…</output>
      ) : (
        <>
          <div className="connection-list">
            {index.cases.map((c) => (
              <a href={unitLink(c.id)} key={c.id} className="course-unit-row">
                <div>
                  <span className="course-meta">
                    {Array.from(
                      new Set(
                        c.unitIds.map(
                          (id) =>
                            manifest.units.find((unit) => unit.id === id)
                              ?.domainId,
                        ),
                      ),
                    )
                      .filter(Boolean)
                      .map((id) => `Domain ${id}`)
                      .join(' · ')}
                  </span>
                  <h2>{c.title}</h2>
                  {state.units[c.id] && <small>In progress</small>}
                </div>
                <ArrowRight size={20} />
              </a>
            ))}
          </div>
          <details className="course-reference">
            <summary>
              {index.referenceRelationships.length} reference connections
            </summary>
            <p>
              These dependencies provide context. They are not developed into
              teaching cases and do not count as practiced relationships.
            </p>
            {index.referenceRelationships.map((r) => (
              <article className="concept-reference" key={r.id}>
                <h3>
                  {r.fromObjectiveId.replace(
                    /^d(\d)-o0?/,
                    'Domain $1 · objective ',
                  )}{' '}
                  →{' '}
                  {r.toObjectiveId.replace(
                    /^d(\d)-o0?/,
                    'Domain $1 · objective ',
                  )}
                </h3>
                <p>{r.rationale}</p>
                <div className="reference-unit-links">
                  {manifest.units
                    .filter(
                      (u) =>
                        u.id.startsWith(r.fromObjectiveId + '-') ||
                        u.id.startsWith(r.toObjectiveId + '-'),
                    )
                    .map((u) => (
                      <a href={unitLink(u.id)} key={u.id}>
                        {u.title}
                      </a>
                    ))}
                </div>
              </article>
            ))}
          </details>
        </>
      )}
    </>
  );
}
