'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Download,
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
  COURSE_STORAGE_KEY,
  courseEvidence,
  dueUnits,
  emptyDraft,
  emptyLearnerState,
  newPosition,
  markViewedOutcomes,
  recordCourseAnswer,
  repairPosition,
  stages,
  validateLearnerState,
  writeProgressBackup,
} from '@/lib/course/learner-state';
import type {
  AnswerDraft,
  LearnerState,
  Stage,
  UnitPosition,
} from '@/lib/course/learner-state';
import { CourseFigure } from './course-figure';
import { CourseLab, hasLab } from './course-labs';
import './course.css';

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
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function useLearner() {
  const [state, setState] = useState(emptyLearnerState);
  const [ready, setReady] = useState(false);
  const [issue, setIssue] = useState('');
  const canSave = useRef(true);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(COURSE_STORAGE_KEY);
        if (raw) setState(validateLearnerState(JSON.parse(raw)));
      } catch {
        canSave.current = false;
        setIssue(
          'Your saved course progress could not be read. It is preserved. You can study for this visit and recover it in Saved progress.',
        );
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== COURSE_STORAGE_KEY || !event.newValue) return;
      try {
        setState(validateLearnerState(JSON.parse(event.newValue)));
      } catch {
        setIssue(
          'Another tab saved unreadable progress. Your current work is retained; export a backup before leaving.',
        );
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    if (!ready || !canSave.current) return;
    try {
      localStorage.setItem(COURSE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      void Promise.resolve().then(() =>
        setIssue(
          'This browser could not save your latest changes. Export a backup before leaving.',
        ),
      );
    }
  }, [ready, state]);
  const restore = (next: LearnerState) => {
    localStorage.setItem(COURSE_STORAGE_KEY, JSON.stringify(next));
    canSave.current = true;
    setIssue('');
    setState(next);
  };
  return { state, setState, ready, issue, restore };
}
export default function CourseApp() {
  const { state, setState, ready, issue, restore } = useLearner();
  const [manifest, setManifest] = useState<CourseManifest | null>(null);
  const [error, setError] = useState('');
  const [route, setRoute] = useState('today');
  const [menu, setMenu] = useState(false);
  const [now, setNow] = useState(0);
  const [reload, setReload] = useState(0);
  const main = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
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
    fetch('/api/course', { signal: controller.signal, cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw Error('Course unavailable');
        return r.json() as Promise<CourseManifest>;
      })
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
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(false);
        menuButton.current?.focus();
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
    { id: 'practice', label: 'Practice & review', Icon: ShieldCheck },
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
      <header className="course-mobile-header">
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
      </header>
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
              href={`#/${n.id}`}
              onClick={closeNavigation}
              aria-current={page === n.id ? 'page' : undefined}
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
          <h2>Your eight domains</h2>
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
            Saved progress & preferences
          </a>
          {/* oxlint-disable-next-line next/no-html-link-for-pages -- Intentional full-document transition avoids Vinext beta's broken RSC prefetch shim. */}
          <a href="/pilot">
            Earlier lessons & saved pilot practice <ArrowRight size={16} />
          </a>
          <small>Progress stays in this browser.</small>
        </div>
      </aside>
      <div
        className="course-workspace"
        onFocusCapture={() => {
          if (menu) setMenu(false);
        }}
      >
        <div className="course-topbar">
          <span>
            {page === 'unit'
              ? 'Learn at your pace'
              : page === 'domain'
                ? `Domain ${id}`
                : 'Your learning workspace'}
          </span>
          <a href="#/curriculum">
            <Search size={17} /> Find a concept
          </a>
          <span className="course-save-status">
            {issue
              ? 'Save needs attention'
              : ready
                ? 'Saved on this device'
                : 'Loading your place…'}
          </span>
        </div>
        <main id="course-main" className="course-main" ref={main} tabIndex={-1}>
          {issue && (
            <div className="course-notice" role="alert">
              {issue} <a href="#/backup">Open saved progress</a>
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
              <h1>Opening your learning space…</h1>
              <p>Bringing in the course outline and your saved place.</p>
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
            <Practice manifest={manifest} state={state} now={now} />
          ) : page === 'backup' ? (
            <Backup state={state} setState={setState} restore={restore} />
          ) : page === 'connections' ? (
            <Connections manifest={manifest} state={state} />
          ) : (
            <Today manifest={manifest} state={state} now={now} />
          )}
        </main>
        <footer className="course-footer">
          <span>Understand the decision. Then try a changed case.</span>
          <span>AI-reviewed source curriculum · no exam-readiness score</span>
        </footer>
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
  const canonicalIds = new Set(manifest.units.map((u) => u.id));
  const evidence = courseEvidence({
      ...state,
      units: Object.fromEntries(
        Object.entries(state.units).filter(([id]) => canonicalIds.has(id)),
      ),
      attempts: state.attempts.filter((a) => canonicalIds.has(a.unitId)),
    }),
    due = dueUnits(state, now);
  const resumedUnit = manifest.units.find((u) => u.id === state.lastUnitId);
  const next = resumedUnit || manifest.units[0];
  return (
    <>
      <div className="course-page-heading">
        <h1>
          {state.lastUnitId
            ? 'A connection worth returning to.'
            : 'Learn how security decisions connect.'}
        </h1>
        <p>
          Start with a worked case. Predict what changes. Carry the idea into a
          new situation.
        </p>
      </div>
      <div className="today-feature">
        <div>
          <span className="course-meta">
            {resumedUnit ? 'Continue your learning' : 'Begin with domain 1'} ·{' '}
            {next.estimatedMinutes} minutes, at your pace
          </span>
          <h2>{next.title}</h2>
          <p>{next.outcome}</p>
          <a className="course-primary" href={unitLink(next.id)}>
            {resumedUnit ? 'Resume this unit' : 'Start learning'}
            <ArrowRight size={18} />
          </a>
        </div>
        <div className="journey-preview" aria-label="Your learning path">
          <div>
            <span>1</span>
            <strong>See the relationship</strong>
            <p>A concrete case, with the explanation beside it.</p>
          </div>
          <div>
            <span>2</span>
            <strong>Make a prediction</strong>
            <p>Explain the decision and learn from the feedback.</p>
          </div>
          <div>
            <span>3</span>
            <strong>Try the changed case</strong>
            <p>Use the same idea when a controlling fact changes.</p>
          </div>
        </div>
      </div>
      {state.lastUnitId?.startsWith('cross-') && (
        <p className="course-notice">
          <a href={unitLink(state.lastUnitId)}>
            Resume your cross-domain case <ArrowRight size={16} />
          </a>
        </p>
      )}
      <div className="today-return">
        <div>
          <h2>
            {due.length
              ? `${due.length} ${due.length === 1 ? 'unit is' : 'units are'} ready to revisit`
              : 'Small sessions, a connected course.'}
          </h2>
          <p>
            {due.length
              ? 'Return to a missed or uncertain decision, inspect its explanation, then try a different case.'
              : 'All eight domains are available. Choose a domain or search a concept to start where it helps.'}
          </p>
          <a href={due.length ? '#/practice' : '#/curriculum'}>
            {due.length ? 'Open your review queue' : 'Explore the curriculum'}
            <ArrowRight size={17} />
          </a>
        </div>
        <dl className="course-evidence">
          <div>
            <dt>Units visited</dt>
            <dd>
              {evidence.visited} / {manifest.counts.units}
            </dd>
          </div>
          <div>
            <dt>Changed cases attempted</dt>
            <dd>
              {evidence.transfers} / {manifest.counts.units}
            </dd>
          </div>
          <div>
            <dt>Distinct questions attempted</dt>
            <dd>{evidence.attempted}</dd>
          </div>
        </dl>
      </div>
      <div className="section-heading">
        <h2>One curriculum. Eight perspectives.</h2>
        <a href="#/curriculum">
          View the full outline
          <ArrowRight size={17} />
        </a>
      </div>
      <div className="domain-overview">
        {manifest.domains.map((d) => (
          <a href={`#/domain/${d.id}`} key={d.id}>
            <span className="domain-number">
              {String(d.id).padStart(2, '0')}
            </span>
            <div>
              <h3>{d.name}</h3>
              <p>
                {manifest.units.filter((u) => u.domainId === d.id).length}{' '}
                learning units
              </p>
            </div>
            <ArrowRight size={19} />
          </a>
        ))}
      </div>
    </>
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
        : 'Not visited';
  return (
    <div className="course-unit-result">
      <a className="course-unit-row" href={unitLink(unit.id)}>
        <div>
          <span className="course-meta">
            Objective {unit.objectiveIds.join(', ')} · {unit.estimatedMinutes}{' '}
            min
          </span>
          <h3>{unit.title}</h3>
          <p>{unit.outcome}</p>
        </div>
        <div className="unit-row-status">
          <span>{status}</span>
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
        <h1>{selected?.name || 'Find the idea. Follow its connections.'}</h1>
        <p>
          {selected
            ? `Explore ${manifest.units.filter((u) => u.domainId === domain).length} units, each with a worked explanation, prediction and changed case.`
            : `${manifest.counts.units} authored units across eight domains. ${manifest.counts.concepts} distinct concepts, explained in their unit contexts.`}
        </p>
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
    fetch(
      `/api/course/${isConnection ? 'connections' : 'units'}/${encodeURIComponent(id)}?release=${encodeURIComponent(manifest.releaseId)}`,
      { signal: controller.signal },
    )
      .then((r) => {
        if (!r.ok)
          throw Error(
            r.status === 404
              ? 'That unit or content release is unavailable.'
              : 'The lesson could not load.',
          );
        return r.json() as Promise<CourseUnit | ConnectionDetail>;
      })
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
  }, [id, manifest.releaseId, manifest.sourceHash, reload, isConnection]);
  useEffect(() => {
    if (manifest.units.some((u) => u.id === id) || connection)
      update({ stage });
  }, [stage, update, manifest.units, id, connection]);
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
      {stage === 'understand' && model && (
        <div className="stage-next">
          <p>Ready to reason through a decision?</p>
          <button className="course-primary" onClick={() => goStage('predict')}>
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
        <h2>{model.question}</h2>
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
          <aside className="mobile-case-context" aria-label="Worked-case facts">
            <h3>The worked case</h3>
            <p>{model.scenario}</p>
          </aside>
          {checkpoint && (
            <aside className="prediction-checkpoint">
              <h3>Predict before revealing the outcome</h3>
              <p>{model.prediction.prompt}</p>
              <p>
                Make a decision now, or continue the explanation at your own
                pace.
              </p>
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
          {model.variants?.length && (
            <div className="scenario-selector">
              <label htmlFor={`variant-${model.unitId}`}>Change one fact</label>
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
          <div className="guided-caption" aria-live="polite" aria-atomic="true">
            <span>
              {step + 1} / {states.length}
            </span>
            <div>
              <h3>
                {checkpoint
                  ? 'Pause for your prediction'
                  : `${lab ? 'Worked case: ' : ''}${current.title}`}
              </h3>
              <p>
                {checkpoint
                  ? 'The entities and case facts are visible. The explanation continues after your prediction or your choice to reveal it.'
                  : current.caption}
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
            <label>
              Pace
              <select
                value={preferences.pace}
                onChange={(e) => {
                  setPlaying(false);
                  setState((s) => ({
                    ...s,
                    preferences: {
                      ...s.preferences,
                      pace: e.target.value as 'step' | 'slow',
                    },
                  }));
                }}
              >
                <option value="step">Standard</option>
                <option value="slow">Slow</option>
              </select>
            </label>
          </div>
          <p className="control-note">
            {reduced
              ? 'Reduced motion is on. Every step remains available manually.'
              : 'Starts paused. Playback paces the explanation; it does not represent elapsed system time.'}{' '}
            Your answers stay saved when you replay.
          </p>
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
  const chosen = check.options.find((o) => o.id === draft.selected);
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
        <h2 id={`check-${check.id}`}>{check.prompt}</h2>
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
        {check.options.map((o, i) => (
          <label
            key={o.id}
            className={`assessment-option ${draft.selected === o.id ? 'is-selected' : ''}`}
          >
            <input
              type="radio"
              name={check.id}
              value={o.id}
              checked={draft.selected === o.id}
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
          {attempt.outcomeViewed && (
            <p>
              Assisted: outcome or explanation viewed before this answer. This
              unit remains ready for review.
            </p>
          )}
          {(attempt.guess || attempt.hintUsed) && (
            <p>
              Your {attempt.hintUsed ? 'hint use' : 'uncertainty'} is saved.
              This unit remains ready for review.
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
function Practice({
  manifest,
  state,
  now,
}: {
  manifest: CourseManifest;
  state: LearnerState;
  now: number;
}) {
  const due = dueUnits(state, now),
    evidence = courseEvidence(state);
  const queue = [
    ...manifest.units.filter((u) => due.includes(u.id)),
    ...due
      .filter((id) => id.startsWith('cross-'))
      .map((id) => ({
        id,
        title: pretty(id.replace(/^cross-/, '').replace('--', ': ')),
      })),
  ];
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
        <span>{queue.length} units</span>
      </div>
      {queue.length ? (
        queue.map((u) => (
          <a
            className="review-queue-row"
            href={unitLink(u.id, 'review')}
            key={u.id}
          >
            <div>
              <h3>{u.title}</h3>
              <p>
                {state.reviews[u.id]?.needsReview
                  ? 'Repair the relationship, then try a changed case.'
                  : 'A spaced review is due.'}
              </p>
            </div>
            <ArrowRight size={20} />
          </a>
        ))
      ) : (
        <div className="course-empty compact">
          <h2>No units are due yet.</h2>
          <p>
            Your next answer will create a review record. You can practice any
            unit at any time.
          </p>
          <a className="course-primary" href="#/curriculum">
            Choose a unit
            <ArrowRight size={18} />
          </a>
        </div>
      )}
      <div className="section-heading">
        <h2>Practice across domains</h2>
        <p>Choose a fresh prediction.</p>
      </div>
      <div className="practice-domain-list">
        {manifest.domains.map((d) => {
          const candidates = manifest.units.filter((u) => u.domainId === d.id);
          const next =
            candidates.find(
              (u) =>
                !state.attempts.some(
                  (a) => a.unitId === u.id && a.kind === 'prediction',
                ),
            ) || candidates[0];
          return (
            <a key={d.id} href={unitLink(next.id, 'predict')}>
              <span>{d.id}</span>
              <div>
                <h3>{d.short}</h3>
                <p>{next.title}</p>
              </div>
              <ArrowRight size={18} />
            </a>
          );
        })}
      </div>
      <div className="review-evidence">
        <h2>What your activity tells you</h2>
        <p>
          {evidence.attempted} distinct questions attempted;{' '}
          {evidence.supportedConcepts} concept labels attached to those
          questions. {evidence.transfers} changed cases attempted, including
          cross-domain cases. Repeats remain in history and do not add distinct
          questions.
        </p>
        <p>
          These are practice counts, not an exam-readiness or mastery score.
        </p>
      </div>
    </>
  );
}
function Backup({
  state,
  setState,
  restore,
}: {
  state: LearnerState;
  setState: Setter;
  restore: (s: LearnerState) => void;
}) {
  const [message, setMessage] = useState(''),
    [pending, setPending] = useState<{
      course?: LearnerState;
      pilot?: unknown;
    } | null>(null);
  async function parse(file: File) {
    setMessage('');
    setPending(null);
    try {
      if (file.size > 20_000_000)
        throw Error('This file is too large for a progress backup.');
      const raw = JSON.parse(await file.text());
      if (raw.format === 'cissp-buddy-combined-v1') {
        const course = validateLearnerState(raw.course);
        let pilot: unknown;
        if (raw.pilot !== null && raw.pilot !== undefined)
          pilot = await validatePilot(raw.pilot);
        setPending({ course, pilot });
      } else if (raw.units && raw.preferences)
        setPending({ course: validateLearnerState(raw) });
      else setPending({ pilot: await validatePilot(raw) });
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : 'The backup could not be read. No progress changed.',
      );
    }
  }
  async function validatePilot(raw: unknown) {
    const [{ validateBackup }, { default: lessons }, { default: questions }] =
      await Promise.all([
        import('@/lib/study-state'),
        import('@/lib/data/lessons.json'),
        import('@/lib/data/questions.json'),
      ]);
    return validateBackup(
      raw,
      lessons.map((l) => l.id),
      questions,
    );
  }
  function exportAll() {
    let pilot: unknown = null;
    const raw = localStorage.getItem('cissp-buddy:v1');
    if (raw) {
      try {
        pilot = JSON.parse(raw);
      } catch {
        setMessage(
          'The earlier pilot record is unreadable. Export its untouched stored copy before replacing it.',
        );
        download('cissp-pilot-stored-recovery.json', { raw });
        return;
      }
    }
    download('cissp-buddy-progress.json', {
      format: 'cissp-buddy-combined-v1',
      exportedAt: new Date().toISOString(),
      course: state,
      pilot,
    });
  }
  return (
    <>
      <div className="course-page-heading">
        <h1>Your learning, safely carried forward.</h1>
        <p>
          Progress is local to this browser and address. Export a backup to move
          it or keep a copy. Earlier pilot attempts retain their original
          question identities.
        </p>
      </div>
      <section className="settings-section">
        <h2>Backup & restore</h2>
        <div className="backup-actions">
          <button className="course-primary" onClick={exportAll}>
            <Download size={18} />
            Export all progress
          </button>
          <label className="course-file-input">
            Choose a backup
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void parse(file);
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={() =>
              download('cissp-stored-recovery.json', {
                course: localStorage.getItem(COURSE_STORAGE_KEY),
                pilot: localStorage.getItem('cissp-buddy:v1'),
              })
            }
          >
            Export untouched stored records
          </button>
        </div>
        {message && <output className="course-notice">{message}</output>}
        {pending && (
          <div className="restore-confirm">
            <h3>Valid backup, ready to restore.</h3>
            <p>
              This replaces{' '}
              {pending.course ? 'your current course progress' : ''}
              {pending.course && pending.pilot ? ' and ' : ''}
              {pending.pilot ? 'your earlier pilot progress' : ''}. Export your
              current progress first if you want to keep both.
            </p>
            <button
              className="course-primary"
              onClick={() => {
                try {
                  writeProgressBackup(localStorage, pending);
                  if (pending.course) restore(pending.course);
                  setPending(null);
                  setMessage(
                    'Backup restored. Your saved position and attempts are available.',
                  );
                } catch {
                  setMessage(
                    'The browser could not write this backup. Export your current progress and free storage before trying again.',
                  );
                }
              }}
            >
              Replace with this backup
            </button>
            <button onClick={() => setPending(null)}>Cancel</button>
          </div>
        )}
        <p>
          {/* oxlint-disable-next-line next/no-html-link-for-pages -- Intentional full-document transition avoids Vinext beta's broken RSC prefetch shim. */}
          <a href="/pilot/#/backup">
            Open earlier pilot progress and backups
            <ArrowRight size={16} />
          </a>
        </p>
      </section>
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
    fetch(
      `/api/course/connections?release=${encodeURIComponent(manifest.releaseId)}`,
      { signal: controller.signal },
    )
      .then((r) => {
        if (!r.ok) throw Error('The linked cases could not load.');
        return r.json() as Promise<ConnectionIndex>;
      })
      .then(setIndex)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [manifest.releaseId, reload]);
  return (
    <>
      <div className="course-page-heading">
        <h1>Follow a decision across domains.</h1>
        <p>
          Eleven bounded cases connect governance, architecture, evidence and
          operations. Each case has a prediction, a changed transfer and a saved
          review.
        </p>
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
                    {c.relationshipIds.length} taught{' '}
                    {c.relationshipIds.length === 1
                      ? 'relationship'
                      : 'relationships'}{' '}
                    ·{' '}
                    {
                      new Set(
                        c.unitIds.map(
                          (id) =>
                            manifest.units.find((u) => u.id === id)?.domainId,
                        ),
                      ).size
                    }{' '}
                    domains
                  </span>
                  <h2>{c.title}</h2>
                  <p>
                    {c.unitIds
                      .map(
                        (id) => manifest.units.find((u) => u.id === id)?.title,
                      )
                      .join(' · ')}
                  </p>
                  <small>
                    {state.units[c.id]
                      ? 'Resume saved case'
                      : 'Open linked case'}
                  </small>
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
