'use client';
import { appUrl } from '@/lib/course/static-loader';
import { LearnerAccountPanel, useAccount } from '@/lib/learner/account';
import { useLearningDataset } from '@/lib/learner/hooks';
import {
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Network,
  Sun,
  Sparkles,
  ShieldCheck,
  CircleCheck,
  Clock3,
  Leaf,
  Search,
  Download,
  Upload,
  Check,
  ChevronRight,
  RotateCcw,
  Pause,
  X,
  Flag,
  Lightbulb,
  ExternalLink,
  Layers,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { ConceptVisual } from '@/components/concept-visual';
import { useCurriculum } from '@/lib/content-provider';
import { RecursiveMap } from '@/components/recursive-map';
import {
  Diagram,
  KnowledgeCheck,
  CardVisual,
} from '@/components/learning-blocks';
import type { Lesson } from '@/lib/curriculum';
import {
  STORAGE_KEY,
  DAY,
  emptyState,
  validateBackup,
  dueConcepts,
  conceptStatus,
  uniqueEvidence,
  selectQuestions,
  recordAnswer,
  advanceSession,
} from '@/lib/study-state';
import type { StudyState } from '@/lib/study-state';
type Setter = Dispatch<SetStateAction<StudyState>>;
type Go = (path: string) => void;

const duration = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const dateLabel = (n: number) =>
  new Date(n).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
function readRoute() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/');
  return ['today', 'learn', 'map', 'practice', 'backup'].includes(parts[0])
    ? parts.join('/')
    : 'today';
}

// A shared wall clock updates review due dates without impure reads during render.
let clockSnapshot = 0;
let clockTimer: ReturnType<typeof setInterval> | undefined;
const clockListeners = new Set<() => void>();
function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (!clockTimer) {
    clockSnapshot = Date.now();
    clockTimer = setInterval(() => {
      clockSnapshot = Date.now();
      clockListeners.forEach((notify) => notify());
    }, 30000);
  }
  return () => {
    clockListeners.delete(listener);
    if (!clockListeners.size) {
      clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}
const getClock = () => clockSnapshot;
const getServerClock = () => 0;
const useClock = () =>
  useSyncExternalStore(subscribeClock, getClock, getServerClock);

export default function Home() {
  const { lessons, questions, shortTitle, nodes } = useCurriculum();
  const conceptIds = useMemo(() => lessons.map((l) => l.id), [lessons]);
  const [route, setRoute] = useState('today'),
    [search, setSearch] = useState(''),
    [practiceIssue, setPracticeIssue] = useState('');
  const validate = useCallback(
    (raw: unknown) => validateBackup(raw, conceptIds, questions),
    [conceptIds, questions],
  );
  const learning = useLearningDataset({
    dataset: 'pilot',
    legacyKey: STORAGE_KEY,
    empty: emptyState,
    validate,
    checkpoint: route,
  });
  const { state, setState, ready, issue: storageIssue } = learning;
  const saveAllowed = !storageIssue;
  const mainRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    const update = () => setRoute(readRoute());
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const go: Go = useCallback((path) => {
    window.location.hash = `/${path}`;
    setRoute(path);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  useEffect(() => {
    // Preserve focus while the persistent search field changes the route.
    const typing = ['INPUT', 'TEXTAREA'].includes(
      document.activeElement?.tagName || '',
    );
    if (ready && !typing) mainRef.current?.focus({ preventScroll: true });
    const parts = route.split('/');
    if (
      parts[0] === 'learn' &&
      parts[2] === 'section' &&
      /^[0-2]$/.test(parts[3] || '')
    ) {
      const frame = requestAnimationFrame(() =>
        document
          .getElementById(`section-${parts[3]}`)
          ?.scrollIntoView({ block: 'start' }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [route, ready]);
  const section = route.split('/')[0],
    selected = route.split('/')[1];
  const activeId = state.active?.id;
  useEffect(() => {
    if (!ready || !activeId || section !== 'practice') return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now(),
        delta = Math.min(now - last, 2000);
      last = now;
      if (document.visibilityState !== 'visible') return;
      setState((s) =>
        s.active
          ? {
              ...s,
              active: {
                ...s.active,
                elapsedMs: s.active.elapsedMs + delta,
                phaseMs: s.active.phaseMs + delta,
              },
            }
          : s,
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [ready, activeId, section, setState]);
  useEffect(() => {
    if (!ready) return;
    const ctx = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!ctx?.registerTool) return;
    const ac = new AbortController();
    const register = (tool: unknown) => {
      try {
        Promise.resolve(ctx.registerTool(tool, { signal: ac.signal })).catch(
          () => {},
        );
      } catch {}
    };
    register({
      name: 'read_study_progress',
      description:
        'Read browser-local lesson coverage and practice counts. Does not estimate exam readiness.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => ({
        completed: stateRef.current.completed,
        uniqueQuestions: uniqueEvidence(stateRef.current).length,
        dueConcepts: dueConcepts(stateRef.current, Date.now()),
      }),
    });
    register({
      name: 'open_study_concept',
      description: 'Navigate to a concept lesson without marking it complete.',
      inputSchema: {
        type: 'object',
        properties: { conceptId: { type: 'string', enum: conceptIds } },
        required: ['conceptId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input: unknown) => {
        if (
          !input ||
          typeof input !== 'object' ||
          !('conceptId' in input) ||
          !conceptIds.includes(String(input.conceptId))
        )
          throw new Error('Unknown concept.');
        go(`learn/${String(input.conceptId)}`);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return { opened: String(input.conceptId) };
      },
    });
    return () => ac.abort();
  }, [ready, go, conceptIds]);
  function start(
    mode: 'recommended' | 'mixed' | 'topic' | 'review',
    topic?: string,
    domainId?: number,
  ) {
    if (state.active) {
      go('practice');
      return;
    }
    const isSubtopic =
      !!topic && nodes.some((n) => n.id === topic && n.parentId);
    const pool = questions.filter(
      (q) =>
        (!domainId || q.metadata.domainId === domainId) &&
        (!isSubtopic || q.metadata.subtopicIds.includes(topic!)),
    );
    const chosen = selectQuestions(
      pool,
      state,
      isSubtopic ? 'mixed' : mode,
      isSubtopic ? undefined : topic,
      Date.now(),
    );
    if (!chosen.length) {
      setPracticeIssue(
        'No questions match this domain and topic. Choose another scope.',
      );
      go('practice');
      return;
    }
    setPracticeIssue('');
    setState((s) => ({
      ...s,
      active: {
        id: uid(),
        questionIds: chosen.map((q) => q.id),
        index: 0,
        phase: 'answer',
        selected: null,
        guess: false,
        hintUsed: false,
        attemptId: null,
        elapsedMs: 0,
        phaseMs: 0,
        label:
          mode === 'topic'
            ? shortTitle(topic || '')
            : mode === 'review'
              ? 'Focused review'
              : mode === 'mixed'
                ? 'Mixed practice'
                : 'Recommended practice',
      },
    }));
    go('practice');
  }
  return (
    <SidebarProvider style={{ '--sidebar-width': '15.5rem' } as CSSProperties}>
      <SideNav
        section={section}
        go={go}
        state={state}
        isAccount={learning.isAccount}
      />
      <SidebarInset>
        <a
          className="skip-link"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            mainRef.current?.focus();
            mainRef.current?.scrollIntoView({ block: 'start' });
          }}
        >
          Skip to content
        </a>
        <header className="topbar">
          <div>
            <SidebarTrigger />
            <span>
              My workspace <span className="slash">/</span>{' '}
              {section === 'map'
                ? 'Concept map'
                : section === 'backup'
                  ? 'Your progress'
                  : section.charAt(0).toUpperCase() + section.slice(1)}
            </span>
          </div>
          {section !== 'map' && (
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                go('learn');
              }}
            >
              <Search size={15} />
              <input
                aria-label="Search concepts"
                placeholder="Find a concept…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (section !== 'learn') go('learn');
                }}
              />
              {search && (
                <button
                  aria-label="Clear search"
                  type="button"
                  onClick={() => setSearch('')}
                >
                  <X size={14} />
                </button>
              )}
            </form>
          )}
          <span className="pilot-tag">FOCUSED PILOT</span>
        </header>
        <div
          id="main-content"
          className="workspace"
          ref={mainRef}
          tabIndex={-1}
        >
          <LearnerAccountPanel learning={learning} />
          {storageIssue && (
            <div className="notice warning" role="alert">
              <AlertCircle size={18} />
              <span>
                {storageIssue}{' '}
                <button className="text-link" onClick={() => go('backup')}>
                  Manage backup
                </button>
              </span>
            </div>
          )}
          {!ready && (
            <output className="content-unavailable">
              Opening your learning record…
            </output>
          )}
          {ready && section === 'today' && (
            <Today state={state} ready={ready} go={go} start={start} />
          )}{' '}
          {ready &&
            section === 'learn' &&
            (selected && lessons.some((l) => l.id === selected) ? (
              <LessonView
                key={selected}
                lesson={lessons.find((l) => l.id === selected)!}
                state={state}
                setState={setState}
                go={go}
                start={start}
                ready={ready}
              />
            ) : (
              <LearnLibrary
                state={state}
                go={go}
                search={search}
                setSearch={setSearch}
              />
            ))}
          {ready && section === 'map' && (
            <RecursiveMap state={state} go={go} selectedId={selected} />
          )}
          {ready && section === 'practice' && (
            <Practice
              issue={practiceIssue}
              state={state}
              setState={setState}
              go={go}
              start={start}
              selected={selected}
              subtopicId={route.split('/')[2]}
              ready={ready}
            />
          )}{' '}
          {ready && section === 'backup' && (
            <Backup
              state={state}
              onRestore={learning.replaceLocal}
              saveAllowed={saveAllowed}
            />
          )}
          <footer className="workspace-footer">
            <span>
              <Leaf size={13} /> A little wiser, every day.
            </span>
            <button onClick={() => go('backup')}>
              <ShieldCheck size={13} />{' '}
              {learning.isAccount
                ? 'Account progress · Backup'
                : 'Saved in this browser · Backup'}
            </button>
          </footer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
function SideNav({
  section,
  go,
  state,
  isAccount,
}: {
  section: string;
  go: Go;
  state: StudyState;
  isAccount: boolean;
}) {
  const { lessons } = useCurriculum();
  const now = useClock();
  const { setOpenMobile } = useSidebar();
  const navigate = (s: string) => {
    go(s);
    setOpenMobile(false);
  };
  const nav = [
    { icon: Sun, label: 'Today', path: 'today' },
    { icon: BookOpen, label: 'Learn', path: 'learn' },
    { icon: Network, label: 'Concept map', path: 'map' },
    { icon: CircleCheck, label: 'Practice', path: 'practice' },
  ];
  return (
    <Sidebar className="buddy-sidebar">
      <SidebarHeader>
        <button
          className="brand"
          onClick={() => navigate('today')}
          aria-label="CISSP Buddy home"
        >
          <span className="brand-mark">
            <Leaf size={24} />
          </span>
          <span>
            CISSP<span className="brand-light"> buddy</span>
            <small>A LITTLE WISER, EVERY DAY</small>
          </span>
        </button>
      </SidebarHeader>
      <SidebarContent>
        <div className="nav-caption">YOUR WORKSPACE</div>
        <SidebarMenu>
          {nav.map(({ icon: Icon, label, path }) => (
            <SidebarMenuItem key={path}>
              <SidebarMenuButton
                className="nav-item"
                isActive={section === path}
                onClick={() => navigate(path)}
                aria-current={section === path ? 'page' : undefined}
              >
                <Icon />
                <span>{label}</span>
                {path === 'practice' && dueConcepts(state, now).length > 0 && (
                  <span className="nav-count">
                    {dueConcepts(state, now).length}
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <div className="sidebar-course">
          <span className="eyebrow">YOUR LEARNING PATH</span>
          <h3>Identity & access</h3>
          <p>
            10 connected concepts.
            <br />
            One clear foundation.
          </p>
          <div
            className="progress-dots"
            aria-label={`${state.completed.length} of 10 lessons completed`}
          >
            {lessons.map((l) => (
              <span
                key={l.id}
                className={state.completed.includes(l.id) ? 'complete' : ''}
              />
            ))}
          </div>
          <span className="muted">
            {state.completed.length} of 10 lessons completed
          </span>
        </div>
        <button className="sidebar-map-link" onClick={() => navigate('map')}>
          <Layers size={15} /> See all eight domains <ArrowUpRight size={14} />
        </button>
      </SidebarContent>
      <SidebarFooter>
        {/* oxlint-disable-next-line next/no-html-link-for-pages -- Intentional full-document transition avoids Vinext beta's broken RSC prefetch shim. */}
        <a href={appUrl('#/today')} className="sidebar-map-link">
          <BookOpen size={15} /> Open the complete 90-unit course{' '}
          <ArrowUpRight size={14} />
        </a>
        <button className="local-note" onClick={() => navigate('backup')}>
          <ShieldCheck size={18} />
          <span>
            Your space to learn
            <small>
              {isAccount
                ? 'Private progress belongs to your account'
                : 'Progress stays in this browser'}
            </small>
          </span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
function Today({
  state,
  ready,
  go,
  start,
}: {
  state: StudyState;
  ready: boolean;
  go: Go;
  start: (
    mode: 'recommended' | 'mixed' | 'topic' | 'review',
    topic?: string,
    domainId?: number,
  ) => void;
}) {
  const { lessons, questions, domains, shortTitle } = useCurriculum();
  const now = useClock();
  const due = dueConcepts(state, now),
    evidence = uniqueEvidence(state);
  const next =
    lessons.find((l) => !state.completed.includes(l.id)) || lessons[0];
  const hasSession = !!state.active;
  const revisit = due.length > 0 && !hasSession;
  const suggested = revisit ? lessons.find((l) => l.id === due[0])! : next;
  const activity = state.attempts.slice(-7);
  return (
    <>
      <PageHeading
        eyebrow="MAKE ROOM FOR A LITTLE PROGRESS"
        title={
          <>
            Build understanding.
            <br />
            <em>One connection at a time.</em>
          </>
        }
        description="Your next chapter starts with the fundamentals of identity and access."
      >
        <div className="date-seal">
          <Sun />
          <span>
            {state.completed.length ? 'Keep your momentum' : 'A fresh start'}
          </span>
        </div>
      </PageHeading>
      <div className="dashboard-grid">
        <section className="feature-card">
          <div className="eyebrow light">
            {hasSession
              ? 'PICK UP WHERE YOU LEFT OFF'
              : revisit
                ? 'A CONNECTION TO STRENGTHEN'
                : 'YOUR NEXT CONCEPT'}
            <span>
              {String(lessons.indexOf(suggested) + 1).padStart(2, '0')} / 10
            </span>
          </div>
          <div className="feature-copy">
            <span className="domain-pill">
              DOMAIN {String(suggested.domain).padStart(2, '0')} ·{' '}
              {domains
                .find((d) => d.id === suggested.domain)!
                .short.toUpperCase()}
            </span>
            <h2>
              {hasSession ? (
                <>
                  A little more
                  <br />
                  understanding.
                </>
              ) : revisit ? (
                <>
                  Let’s make
                  <br />
                  it stick.
                </>
              ) : suggested.id === 'identity' ? (
                <>
                  First, who
                  <br />
                  are you?
                </>
              ) : (
                shortTitle(suggested.id)
              )}
            </h2>
            <p>
              {hasSession
                ? `${state.active!.label}: ${state.active!.index} of ${state.active!.questionIds.length} questions finished. Your place is saved.`
                : revisit
                  ? `Revisit ${shortTitle(suggested.id).toLowerCase()} with a new scenario and a clearer explanation.`
                  : suggested.id === 'identity'
                    ? 'Understand digital identity—and the difference between claiming an identity and proving it.'
                    : suggested.subtitle}
            </p>
            <button
              disabled={!ready}
              className="button cream"
              onClick={() =>
                hasSession
                  ? go('practice')
                  : revisit
                    ? start('review')
                    : go(`learn/${suggested.id}`)
              }
            >
              {hasSession
                ? 'Resume practice'
                : revisit
                  ? 'Review this connection'
                  : `Explore ${suggested.id === 'identity' ? 'identity' : 'the concept'}`}{' '}
              <ArrowRight size={17} />
            </button>
            <div className="feature-meta">
              <Clock3 size={14} />{' '}
              {hasSession
                ? 'At your pace'
                : revisit
                  ? 'About 10 min'
                  : `${suggested.minutes} min lesson`}{' '}
              <span>·</span> {revisit ? 'Fresh thinking' : 'Visual guide'}
            </div>
          </div>
          <div
            className="identity-art"
            aria-label="Identify who you are, authenticate the claim, then authorize access"
          >
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-node node-one">
              <span>01</span>
              <strong>Identity</strong>
              <small>Who are you?</small>
            </div>
            <div className="art-node node-two">
              <span>02</span>
              <strong>Authentication</strong>
              <small>Prove it.</small>
            </div>
            <div className="art-node node-three">
              <span>03</span>
              <strong>Authorization</strong>
              <small>What can you do?</small>
            </div>
          </div>
        </section>
        <section className="practice-promo">
          <span className="mini-icon">
            <Sparkles />
          </span>
          <span className="eyebrow">SMALL SESSION. CLEARER THINKING.</span>
          <h2>
            Ten minutes.
            <br />
            Make them count.
          </h2>
          <p>Put a few concepts to work with real-world scenarios.</p>
          <button
            disabled={!ready}
            className="button outline"
            onClick={() => start('recommended')}
          >
            {hasSession ? 'Continue your practice' : 'Start a quick practice'}{' '}
            <ArrowUpRight size={17} />
          </button>
          <span className="muted">
            Up to 4 questions · explanations included
          </span>
        </section>
      </div>
      <div className="stats-strip">
        <div>
          <span>Lessons completed</span>
          <strong>
            {state.completed.length} <small>/ {lessons.length}</small>
          </strong>
          <Progress
            value={(state.completed.length / lessons.length) * 100}
            aria-label="Lessons completed"
          />
        </div>
        <div>
          <span>Unique questions tried</span>
          <strong>
            {evidence.length} <small>/ {questions.length}</small>
          </strong>
          <p>
            {evidence.length
              ? `${state.attempts.length - evidence.length} repeat encounters · teaching practice`
              : 'Begin with a curious mind.'}
          </p>
        </div>
        <div>
          <span>Ready to revisit</span>
          <strong>
            {due.length} <small>concepts</small>
          </strong>
          <button className="text-link" onClick={() => go('practice/review')}>
            {due.length ? 'Open your review queue' : 'See your review schedule'}{' '}
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
      <div className="section-heading">
        <h2>See the bigger picture</h2>
        <button className="text-link" onClick={() => go('map')}>
          Explore the map <ArrowUpRight size={16} />
        </button>
      </div>
      <section className="connection-preview">
        <div>
          <span className="eyebrow">EVERY CONCEPT CONNECTS</span>
          <h3>Knowledge that fits together.</h3>
          <p>
            Follow the thread from identity to access decisions.
            <br />
            Connect the ideas, not just the definitions.
          </p>
        </div>
        <div className="concept-chain">
          {['identity', 'authentication', 'authorization'].map((id, i) => (
            <span className="chain-item" key={id}>
              <button onClick={() => go(`map/${id}`)}>{shortTitle(id)}</button>
              {i < 2 && <ArrowRight />}
            </span>
          ))}
        </div>
      </section>
      <div className="section-heading">
        <h2>Your learning landscape</h2>
        <span className="muted">
          Pilot coverage · not an exam-readiness score
        </span>
      </div>
      <div className="landscape">
        {[5, 1, 2].map((id) => {
          const d = domains.find((d) => d.id === id)!;
          const ls = lessons.filter((l) => l.domain === id);
          const count = ls.filter((l) => state.completed.includes(l.id)).length;
          return (
            <button
              key={id}
              className="landscape-item"
              onClick={() =>
                go(
                  `map/${id === 5 ? 'identity' : id === 1 ? 'risk' : 'classification'}`,
                )
              }
            >
              <span className="domain-dot" style={{ background: d.color }} />
              <span>
                <strong>{d.short}</strong>
                <small>{ls.length} concepts in this pilot</small>
              </span>
              <span>
                {count}/{ls.length}
              </span>
              <ChevronRight size={16} />
            </button>
          );
        })}
      </div>
      {activity.length > 0 && (
        <div className="evidence-note">
          <Lightbulb size={18} />
          <p>
            {evidence.length < 6
              ? 'Not enough practice evidence yet.'
              : 'Your practice history is growing.'}{' '}
            These original teaching questions help reveal gaps; they do not
            estimate your chance of passing.
          </p>
        </div>
      )}
    </>
  );
}
function LearnLibrary({
  state,
  go,
  search,
  setSearch,
}: {
  state: StudyState;
  go: Go;
  search: string;
  setSearch: (s: string) => void;
}) {
  const { lessons, shortTitle } = useCurriculum();
  const now = useClock();
  const [filter, setFilter] = useState('all');
  const listed = lessons.filter(
    (l) =>
      (filter === 'all' || String(l.domain) === filter) &&
      `${l.title} ${l.summary} ${l.subtitle}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="THE CONCEPT LIBRARY"
        title={
          <>
            Learn the idea.
            <br />
            <em>Remember the connection.</em>
          </>
        }
        description="Ten visual lessons on identity, access, and the decisions behind them."
      />
      <div className="library-toolbar">
        <Tabs value={filter} onValueChange={(v) => setFilter(String(v))}>
          <TabsList className="filter-tabs">
            <TabsTrigger value="all">
              All concepts <span>10</span>
            </TabsTrigger>
            <TabsTrigger value="5">Identity & access</TabsTrigger>
            <TabsTrigger value="1">Risk</TabsTrigger>
            <TabsTrigger value="2">Assets</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="muted">{listed.length} lessons</span>
      </div>
      {search && (
        <p className="search-summary">
          Results for “{search}”{' '}
          <button className="text-link" onClick={() => setSearch('')}>
            Clear search <X size={12} />
          </button>
        </p>
      )}
      <div className="lesson-grid">
        {listed.map((l) => {
          const index = lessons.indexOf(l),
            status = conceptStatus(state, l.id, now);
          return (
            <button
              className="lesson-card"
              key={l.id}
              onClick={() => go(`learn/${l.id}`)}
            >
              <div className={`lesson-card-art art-${l.domain}`}>
                <span className="lesson-index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <CardVisual visual={l.design.cardVisual} />
                <span className="lesson-time">
                  <Clock3 size={12} />
                  {l.minutes} min
                </span>
              </div>
              <div className="lesson-card-body">
                <div className="lesson-card-meta">
                  <span>DOMAIN {String(l.domain).padStart(2, '0')}</span>
                  <span
                    className={`status status-${status.toLowerCase().replace(' ', '-')}`}
                  >
                    {state.completed.includes(l.id) ? (
                      <>
                        <Check size={12} /> Completed
                      </>
                    ) : (
                      status
                    )}
                  </span>
                </div>
                <h2>{shortTitle(l.id)}</h2>
                <p>{l.subtitle}</p>
                <span className="lesson-card-link">
                  {state.visited.includes(l.id)
                    ? 'Revisit concept'
                    : 'Explore concept'}{' '}
                  <ArrowUpRight size={15} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {listed.length === 0 && (
        <div className="empty-state">
          <Search />
          <h2>No matching concepts</h2>
          <p>Try “authentication”, “risk”, or a broader search.</p>
          <button
            className="button outline"
            onClick={() => {
              setSearch('');
              setFilter('all');
            }}
          >
            Show all lessons
          </button>
        </div>
      )}
      <div className="evidence-note">
        <BookOpen size={18} />
        <p>
          This pilot covers selected topics from domains 1, 2, and 5. The other
          domains are shown on the map for orientation; their lessons are not
          included yet.
        </p>
      </div>
    </>
  );
}
function LessonView({
  lesson: l,
  state,
  setState,
  go,
  start,
  ready,
}: {
  lesson: Lesson & { design: import('@/lib/curriculum').LearningDesign };
  state: StudyState;
  setState: Setter;
  go: Go;
  start: (mode: 'topic', topic: string) => void;
  ready: boolean;
}) {
  const { edges, shortTitle } = useCurriculum();
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (ready)
      setState((s) =>
        s.visited.includes(l.id) ? s : { ...s, visited: [...s.visited, l.id] },
      );
  }, [l.id, ready, setState]);
  const related = edges.filter((e) => e.from === l.id || e.to === l.id);
  return (
    <>
      <button className="back-link" onClick={() => go('learn')}>
        <ArrowLeft size={16} /> All concepts
      </button>
      <div className="lesson-layout">
        <article className="lesson-article">
          <div className="eyebrow">
            DOMAIN {String(l.domain).padStart(2, '0')} · OBJECTIVE {l.objective}{' '}
            <span className="inline-meta">{l.minutes} MIN READ</span>
          </div>
          <h1>{shortTitle(l.id)}</h1>
          <p className="lesson-deck">{l.subtitle}</p>
          <p className="lesson-summary">{l.summary}</p>
          <ConceptVisual id={l.id} visual={l.design.leadVisual} />
          {l.sections.map((s, i) => (
            <div key={s.title}>
              <section className="lesson-section" id={`section-${i}`}>
                <span className="section-number">0{i + 1}</span>
                <div>
                  <h2>{s.title}</h2>
                  <p>{s.body}</p>
                </div>
              </section>
              {l.design.blocks
                .filter((block) => block.afterSection === i)
                .map((block) =>
                  block.type === 'diagram' ? (
                    <Diagram key={block.id} block={block} />
                  ) : (
                    <KnowledgeCheck key={block.id} block={block} />
                  ),
                )}
            </div>
          ))}
          <div className="analogy-callout">
            <Lightbulb size={22} />
            <div>
              <span className="eyebrow">MAKE IT MEMORABLE</span>
              <p>{l.analogy}</p>
            </div>
          </div>
          <section className="misconception">
            <span className="eyebrow">THE DISTINCTION THAT MATTERS</span>
            <div className="misconception-wrong">
              <X size={17} />
              <p>{l.misconception.wrong}</p>
            </div>
            <div className="misconception-right">
              <Check size={17} />
              <p>{l.misconception.right}</p>
            </div>
          </section>
          <section className="recall-card">
            <span className="eyebrow">PAUSE. RECALL. CONNECT.</span>
            <h2>{l.recall.question}</h2>
            {reveal ? (
              <p className="recall-answer" aria-live="polite">
                {l.recall.answer}
              </p>
            ) : (
              <p>
                Try answering in your own words before revealing the
                explanation.
              </p>
            )}
            <button
              className="button outline"
              onClick={() => setReveal(!reveal)}
            >
              {reveal ? 'Hide explanation' : 'Reveal explanation'}{' '}
              <ArrowRight size={15} />
            </button>
          </section>
          <div className="lesson-finish">
            <div>
              <span className="eyebrow">TAKE THIS WITH YOU</span>
              <p>{l.takeaway}</p>
            </div>
            <div className="button-row">
              <button
                className="button"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    completed: Array.from(new Set([...s.completed, l.id])),
                  }))
                }
                disabled={!ready || state.completed.includes(l.id)}
              >
                <Check size={16} />
                {state.completed.includes(l.id)
                  ? 'Lesson completed'
                  : 'Mark as complete'}
              </button>
              <button
                className="button outline"
                onClick={() => start('topic', l.id)}
              >
                Practice this concept <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
          <details className="sources">
            <summary>
              References & content review <span>AI source-checked</span>
            </summary>
            <p>
              {l.review.note} Reviewed {l.review.date}. These lessons are
              independent study material, not official ISC2 training.
            </p>
            <ul>
              {l.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                    <ExternalLink size={12} />
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </article>
        <aside className="lesson-aside">
          <span className="eyebrow">IN THIS CONCEPT</span>
          <nav>
            {l.sections.map((s, i) => (
              <a
                key={s.title}
                href={`#section-${i}`}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(`section-${i}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <span>0{i + 1}</span>
                {s.title}
              </a>
            ))}
          </nav>
          <div className="related-card">
            <Network size={21} />
            <h3>Follow the connection</h3>
            <p>See where this idea leads.</p>
            {related.slice(0, 5).map((e, i) => {
              const other = e.from === l.id ? e.to : e.from;
              return (
                <button key={i} onClick={() => go(`learn/${other}`)}>
                  <small>{e.from === l.id ? e.label : `${e.label} ←`}</small>
                  <span>
                    {shortTitle(other)}
                    <ArrowUpRight size={13} />
                  </span>
                </button>
              );
            })}
            <button className="text-link" onClick={() => go(`map/${l.id}`)}>
              Open in concept map <ArrowRight size={13} />
            </button>
          </div>
          <div className="lesson-evidence">
            <span className="eyebrow">YOUR PRACTICE EVIDENCE</span>
            <strong>
              {
                new Set(
                  state.attempts
                    .filter((a) => a.conceptId === l.id)
                    .map((a) => a.questionId),
                ).size
              }{' '}
              / 3
            </strong>
            <p>
              Unique scenarios attempted. Repeated questions do not add new
              evidence.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
function TopicSelect({
  value,
  onChange,
  label = 'Choose a concept',
  all = false,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  all?: boolean;
}) {
  const { lessons, shortTitle, nodes } = useCurriculum();
  return (
    <Select value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger className="topic-select" aria-label={label}>
        <SelectValue>
          {value === 'all' ? 'All concepts' : shortTitle(value)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {nodes.some((n) => n.id === value && n.parentId) && (
          <SelectItem value={value}>{shortTitle(value)} · subtopic</SelectItem>
        )}
        {all && <SelectItem value="all">All concepts</SelectItem>}
        {lessons.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            {shortTitle(l.id)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Practice({
  issue,
  state,
  setState,
  go,
  start,
  selected,
  subtopicId,
  ready,
}: {
  issue: string;
  state: StudyState;
  setState: Setter;
  go: Go;
  start: (
    mode: 'recommended' | 'mixed' | 'topic' | 'review',
    topic?: string,
    domainId?: number,
  ) => void;
  selected?: string;
  subtopicId?: string;
  ready: boolean;
}) {
  const { lessons, questions, domains, shortTitle } = useCurriculum();
  const now = useClock();
  const [topic, setTopic] = useState(subtopicId || 'identity'),
    [practiceDomain, setPracticeDomain] = useState('all'),
    [mode, setMode] = useState<'recommended' | 'mixed' | 'topic'>(
      subtopicId ? 'topic' : 'recommended',
    ),
    [summary, setSummary] = useState<string | null>(null);
  const tab = selected === 'review' ? 'review' : 'practice';
  const s = state.active;
  const q = s ? questions.find((q) => q.id === s.questionIds[s.index]) : null;
  const attempt =
    s && q ? state.attempts.find((a) => a.id === s.attemptId) : null;
  if (s && q && tab === 'practice')
    return (
      <div className="quiz-wrap">
        <div className="quiz-topline">
          <button className="back-link" onClick={() => go('today')}>
            <Pause size={15} /> Pause & save
          </button>
          <span className="quiz-timer">
            <Clock3 size={16} />
            {duration(s.elapsedMs)} <small>/ ~10 min</small>
          </span>
        </div>
        <div className="quiz-meta">
          <span className="eyebrow">{s.label.toUpperCase()}</span>
          <span>
            Question {s.index + 1} of {s.questionIds.length}
          </span>
        </div>
        <Progress
          value={(s.index / s.questionIds.length) * 100}
          aria-label="Session progress"
        />
        <div className="question-card">
          <div className="question-tags">
            <span>
              DOMAIN 0{lessons.find((l) => l.id === q.conceptId)!.domain} ·{' '}
              {shortTitle(q.conceptId)}
            </span>
            {state.attempts.some(
              (a) => a.questionId === q.id && a.id !== s.attemptId,
            ) && <span className="repeat-tag">Repeat practice</span>}
          </div>
          <div className="question-concept-tags">
            {q.metadata.subtopicIds.map((id) => (
              <button key={id} onClick={() => go(`map/${id}`)}>
                <Network size={12} />
                {shortTitle(id)}
              </button>
            ))}
            <span>
              {q.metadata.difficulty} · Objective {q.metadata.objective}
            </span>
          </div>
          <h1>{q.stem}</h1>
          <RadioGroup
            aria-label="Choose the best answer"
            className="answer-list"
            value={s.selected === null ? '' : String(s.selected)}
            onValueChange={(v) =>
              setState((p) =>
                p.active && p.active.phase === 'answer'
                  ? { ...p, active: { ...p.active, selected: Number(v) } }
                  : p,
              )
            }
            disabled={s.phase === 'explanation'}
          >
            {q.options.map((option, i) => (
              <label
                key={i}
                htmlFor={`answer-${i}`}
                className={`answer-option ${s.selected === i ? 'chosen' : ''} ${s.phase === 'explanation' ? (i === q.correctIndex ? 'correct' : s.selected === i ? 'incorrect' : '') : ''}`}
              >
                <RadioGroupItem id={`answer-${i}`} value={String(i)} />
                <span className="answer-letter">{'ABCD'[i]}</span>
                <span>{option}</span>
                {s.phase === 'explanation' && i === q.correctIndex && (
                  <Check size={18} />
                )}
              </label>
            ))}
          </RadioGroup>
          {s.phase === 'answer' && (
            <div className="practice-hint">
              {s.hintUsed ? (
                <p>
                  <Lightbulb size={16} />
                  <span>
                    {q.metadata.hint}
                    <small>
                      This answer will be recorded as hint-assisted practice.
                    </small>
                  </span>
                </p>
              ) : (
                <button
                  className="text-link"
                  onClick={() =>
                    setState((p) =>
                      p.active
                        ? { ...p, active: { ...p.active, hintUsed: true } }
                        : p,
                    )
                  }
                >
                  <Lightbulb size={15} /> Give me a hint
                </button>
              )}
            </div>
          )}
          {s.phase === 'answer' ? (
            <div className="quiz-actions">
              <label className="check-label" htmlFor="guess-flag">
                <Checkbox
                  id="guess-flag"
                  checked={s.guess}
                  onCheckedChange={(v) =>
                    setState((p) =>
                      p.active
                        ? { ...p, active: { ...p.active, guess: v } }
                        : p,
                    )
                  }
                />
                <Flag size={14} /> Mark as guess <small>optional</small>
              </label>
              <button
                className="button"
                disabled={s.selected === null}
                onClick={() => setState((p) => recordAnswer(p, q, Date.now()))}
              >
                Check answer <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="answer-feedback" aria-live="polite">
              <div
                className={`feedback-heading ${attempt?.correct ? 'is-correct' : 'is-learning'}`}
              >
                {attempt?.correct ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <Lightbulb size={22} />
                )}
                <h2>
                  {attempt?.correct
                    ? 'That’s the best answer.'
                    : 'A useful distinction to keep.'}
                </h2>
                {attempt?.guess && (
                  <span className="status">Marked as guess</span>
                )}
              </div>
              {attempt?.hintUsed && (
                <p className="hint-assisted-label">
                  Hint-assisted practice · scheduled for review, separate from
                  unassisted answers.
                </p>
              )}
              <div className="question-learning-links">
                <span className="eyebrow">FOLLOW THE EXPLANATION</span>
                {q.metadata.learningLinks.map((link, i) => (
                  <button
                    key={i}
                    onClick={() =>
                      go(`learn/${link.lessonId}/section/${link.sectionIndex}`)
                    }
                  >
                    <BookOpen size={14} />
                    {link.label}
                    <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>
              <p className="decisive-detail">
                <strong>The decisive detail</strong>
                {q.decisiveDetail}
              </p>
              <div className="option-explanations">
                {q.explanations.map((text, i) => (
                  <p key={i}>
                    <span
                      className={i === q.correctIndex ? 'correct-letter' : ''}
                    >
                      {'ABCD'[i]}
                    </span>
                    {text}
                  </p>
                ))}
              </div>
              <div className="quiz-takeaway">
                <Lightbulb size={18} />
                <p>{q.takeaway}</p>
              </div>
              <details className="sources">
                <summary>Source & review</summary>
                <p>
                  Original instructional item · {q.review.status} ·{' '}
                  {q.review.date}. Not independently expert-reviewed.
                </p>
                <a href={q.source.url} target="_blank" rel="noreferrer">
                  {q.source.title}
                  <ExternalLink size={12} />
                </a>
              </details>
              <div className="quiz-actions">
                <button
                  className="text-link"
                  onClick={() => go(`learn/${q.conceptId}`)}
                >
                  Revisit the concept <ArrowUpRight size={14} />
                </button>
                <button
                  className="button"
                  onClick={() => {
                    if (s.index + 1 === s.questionIds.length) setSummary(s.id);
                    setState((p) => advanceSession(p, Date.now()));
                  }}
                >
                  {s.index + 1 === s.questionIds.length
                    ? 'Finish session'
                    : 'Next question'}{' '}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="quiz-footnote">
          About ten minutes, including explanations. Take the time you need;
          there is no cutoff.
        </p>
      </div>
    );
  if (summary && !s) {
    const done = state.sessions.find((x) => x.id === summary);
    const attempts = state.attempts.filter((a) =>
      a.id.startsWith(summary + ':'),
    );
    return (
      <div className="session-summary">
        <span className="summary-icon">
          <CheckCircle2 size={34} />
        </span>
        <span className="eyebrow">ONE SESSION. MORE CONNECTIONS.</span>
        <h1>
          A little clearer
          <br />
          <em>than before.</em>
        </h1>
        <p>
          You worked through {attempts.length} scenarios. Keep the ideas that
          changed your thinking.
        </p>
        <div className="summary-stats">
          <div>
            <strong>
              {attempts.filter((a) => a.correct && !a.hintUsed).length}/
              {attempts.length}
            </strong>
            <span>Correct without hints</span>
          </div>
          <div>
            <strong>{duration(done?.elapsedMs || 0)}</strong>
            <span>Answering + explanations</span>
          </div>
          <div>
            <strong>
              {
                attempts.filter((a) => !a.correct || a.guess || a.hintUsed)
                  .length
              }
            </strong>
            <span>Added to review</span>
          </div>
        </div>
        <div className="summary-concepts">
          {attempts.map((a) => (
            <div key={a.id}>
              {a.correct && !a.guess && !a.hintUsed ? (
                <CheckCircle2 size={17} />
              ) : (
                <RotateCcw size={17} />
              )}
              <span>{shortTitle(a.conceptId)}</span>
              <small>
                {a.hintUsed
                  ? 'Hint-assisted · review'
                  : a.guess
                    ? 'Guessed · review'
                    : a.correct
                      ? 'Practiced'
                      : 'Needs review'}
              </small>
              <button
                className="text-link"
                onClick={() => go(`learn/${a.conceptId}`)}
              >
                Lesson <ArrowUpRight size={13} />
              </button>
            </div>
          ))}
        </div>
        <p className="muted">
          This is teaching practice, not an estimate of exam readiness.
        </p>
        <div className="button-row">
          <button className="button" onClick={() => go('today')}>
            Back to Today <ArrowRight size={16} />
          </button>
          <button
            className="button outline"
            onClick={() => {
              setSummary(null);
              go('practice/review');
            }}
          >
            Open your review queue
          </button>
        </div>
      </div>
    );
  }
  return (
    <>
      {issue && <output className="hint-box">{issue}</output>}
      <PageHeading
        eyebrow="PUT UNDERSTANDING TO WORK"
        title={
          <>
            Practice the decision.
            <br />
            <em>Keep the lesson.</em>
          </>
        }
        description="Short scenarios, thoughtful explanations, and a little progress that lasts."
      />
      <Tabs
        value={tab}
        onValueChange={(v) =>
          go(v === 'review' ? 'practice/review' : 'practice')
        }
      >
        <TabsList className="filter-tabs">
          <TabsTrigger value="practice">
            <CircleCheck size={14} /> Quick practice
          </TabsTrigger>
          <TabsTrigger value="review">
            <RotateCcw size={14} /> Review & notebook{' '}
            <span>{dueConcepts(state, now).length}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'review' ? (
        <ReviewPanel state={state} setState={setState} go={go} start={start} />
      ) : (
        <>
          {s && (
            <div className="resume-banner">
              <Clock3 size={20} />
              <div>
                <strong>You have a session in progress</strong>
                <p>
                  {s.label} · question {s.index + 1} of {s.questionIds.length}
                </p>
              </div>
              <button className="button" onClick={() => go('practice')}>
                Resume <ArrowRight size={15} />
              </button>
            </div>
          )}
          <div className="practice-setup">
            <div className="practice-setup-main">
              <span className="mini-icon">
                <Sparkles />
              </span>
              <h2>What would you like to work on?</h2>
              <label className="eyebrow" htmlFor="practice-domain">
                DOMAIN SCOPE
              </label>
              <Select
                value={practiceDomain}
                onValueChange={(v) => setPracticeDomain(String(v))}
              >
                <SelectTrigger id="practice-domain" className="topic-select">
                  <SelectValue>
                    {practiceDomain === 'all'
                      ? 'All pilot domains'
                      : domains.find((d) => String(d.id) === practiceDomain)
                          ?.short}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All pilot domains</SelectItem>
                  {domains
                    .filter((d) =>
                      questions.some((q) => q.metadata.domainId === d.id),
                    )
                    .map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        Domain {d.id} · {d.short}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as typeof mode)}
                aria-label="Practice mode"
                className="practice-modes"
              >
                {[
                  {
                    id: 'recommended',
                    title: 'Recommended for you',
                    description:
                      'Prioritize concepts due for review and questions you haven’t tried.',
                  },
                  {
                    id: 'topic',
                    title: 'One concept, a little deeper',
                    description:
                      'Explore a single idea through three different scenarios.',
                  },
                  {
                    id: 'mixed',
                    title: 'Make connections across topics',
                    description:
                      'A balanced mix of the least-practiced concepts in this pilot.',
                  },
                ].map((m) => (
                  <label
                    key={m.id}
                    htmlFor={`mode-${m.id}`}
                    className={`practice-mode ${mode === m.id ? 'selected' : ''}`}
                  >
                    <RadioGroupItem id={`mode-${m.id}`} value={m.id} />
                    <span>
                      <strong>{m.title}</strong>
                      <small>{m.description}</small>
                    </span>
                  </label>
                ))}
              </RadioGroup>
              {mode === 'topic' && (
                <TopicSelect value={topic} onChange={setTopic} />
              )}
              <button
                className="button"
                disabled={!ready}
                onClick={() =>
                  start(
                    mode,
                    topic,
                    practiceDomain === 'all'
                      ? undefined
                      : Number(practiceDomain),
                  )
                }
              >
                Start {mode === 'topic' ? '3' : '4'}-question session{' '}
                <ArrowRight size={17} />
              </button>
              <p className="muted">
                ~10 minutes, including explanations. Pause whenever you need.
              </p>
            </div>
            <aside className="practice-guide">
              <span className="eyebrow">
                A SMALL CHANGE IN HOW YOU PRACTICE
              </span>
              <h3>
                Understand why.
                <br />
                Not just which.
              </h3>
              <ol>
                <li>
                  <span>01</span>
                  <div>
                    <strong>Read for the decision.</strong>
                    <p>Notice the business need, scope, and constraints.</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Choose, then reflect.</strong>
                    <p>
                      Mark a guess if you’re unsure. It helps shape your review.
                    </p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Keep the distinction.</strong>
                    <p>
                      Every answer explains why the alternatives are weaker.
                    </p>
                  </div>
                </li>
              </ol>
              <div className="practice-bank-meta">
                30 original teaching questions
                <br />
                10 concepts · 3 domains
                <br />
                <span>AI source-checked, not expert-validated</span>
              </div>
            </aside>
          </div>
          {state.sessions.length > 0 && (
            <section className="session-history">
              <div className="section-heading">
                <h2>Recent sessions</h2>
                <span className="muted">
                  Last {Math.min(state.sessions.length, 5)}
                </span>
              </div>
              {state.sessions
                .slice(-5)
                .reverse()
                .map((s) => (
                  <button key={s.id} onClick={() => setSummary(s.id)}>
                    <CircleCheck size={18} />
                    <span>{dateLabel(s.completedAt)}</span>
                    <span>{s.count} scenarios</span>
                    <span>{duration(s.elapsedMs)}</span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
function ReviewPanel({
  state,
  setState,
  go,
  start,
}: {
  state: StudyState;
  setState: Setter;
  go: Go;
  start: (mode: 'review' | 'topic', topic?: string) => void;
}) {
  const { questions, shortTitle } = useCurriculum();
  const now = useClock();
  const [filter, setFilter] = useState('all'),
    [manual, setManual] = useState(''),
    [noteConcept, setNoteConcept] = useState('identity');
  const due = dueConcepts(state, now);
  const cards = Object.entries(state.reviews).sort(
    (a, b) => a[1].dueAt - b[1].dueAt,
  );
  const mistakes = state.attempts
    .filter(
      (a) =>
        (!a.correct || a.guess || a.hintUsed) &&
        (filter === 'all' || a.conceptId === filter),
    )
    .slice()
    .reverse();
  const notes = state.notes.filter(
    (n) =>
      !n.id.startsWith('attempt:') &&
      (filter === 'all' || n.conceptId === filter),
  );
  function saveTakeaway(id: string, conceptId: string, text: string) {
    setState((s) => ({
      ...s,
      notes: [
        ...s.notes.filter((n) => n.id !== id),
        ...(text.trim()
          ? [
              {
                id,
                conceptId,
                text: text.trim().slice(0, 2000),
                createdAt: Date.now(),
              },
            ]
          : []),
      ],
    }));
  }
  return (
    <div className="review-panel">
      <div className="review-header">
        <div>
          <h2>
            {due.length
              ? `${due.length} connection${due.length === 1 ? '' : 's'} ready to strengthen.`
              : 'Give good ideas time to settle.'}
          </h2>
          <p>
            {due.length
              ? 'Revisit the idea with another scenario.'
              : 'Your review schedule grows as you practice.'}
          </p>
        </div>
        {due.length > 0 && (
          <button className="button" onClick={() => start('review')}>
            Start focused review <ArrowRight size={16} />
          </button>
        )}
      </div>
      {cards.length > 0 ? (
        <div className="review-schedule">
          {cards.map(([id, c]) => (
            <div className="review-row" key={id}>
              <span className={`review-dot ${c.dueAt <= now ? 'due' : ''}`} />
              <div>
                <strong>{shortTitle(id)}</strong>
                <small>
                  {c.needsReview
                    ? 'A mistake, guess, or hint to revisit'
                    : 'Spaced practice'}
                </small>
              </div>
              <span>
                {c.dueAt <= now
                  ? 'Ready now'
                  : `In ${Math.ceil((c.dueAt - now) / DAY)} days`}
              </span>
              <button className="text-link" onClick={() => start('topic', id)}>
                Practice <ArrowUpRight size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state small-empty">
          <RotateCcw />
          <h3>No reviews yet</h3>
          <p>
            Take a short practice session to start your personal review queue.
          </p>
          <button className="button outline" onClick={() => go('practice')}>
            Try a practice session
          </button>
        </div>
      )}
      <details className="schedule-explainer">
        <summary>How review timing works</summary>
        <p>
          Misses, guesses, and hint-assisted answers are ready to revisit now. A
          correct, unmarked answer schedules the concept in 3 days; later
          correct reviews double the interval, up to 30 days. An unmarked answer
          has unknown confidence. We prefer questions you haven’t seen and label
          repeat encounters.
        </p>
      </details>
      <div className="section-heading">
        <h2>Your mistake notebook</h2>
        <TopicSelect
          value={filter}
          onChange={setFilter}
          all
          label="Filter notebook by concept"
        />
      </div>
      {mistakes.length === 0 && notes.length === 0 && (
        <p className="notebook-empty">
          Mistakes are useful material. Your explanations and personal takeaways
          will collect here.
        </p>
      )}
      <div className="mistake-list">
        {mistakes.map((a) => {
          const current = questions.find((q) => q.id === a.questionId)!;
          const q = { ...current, ...a.questionSnapshot };
          return (
            <details className="mistake-item" key={a.id}>
              <summary>
                <span className="mistake-symbol">
                  {a.guess ? <Flag size={16} /> : <Lightbulb size={16} />}
                </span>
                <span>
                  <strong>{shortTitle(a.conceptId)}</strong>
                  <small>{q.takeaway}</small>
                </span>
                <span className="mistake-date">
                  {dateLabel(a.at)} ·{' '}
                  {a.hintUsed
                    ? 'Hint-assisted'
                    : a.guess
                      ? 'Guessed'
                      : 'Missed'}
                </span>
              </summary>
              <div className="mistake-body">
                <p>{q.stem}</p>
                <p>
                  <strong>Your answer:</strong> {q.options[a.chosen]}
                </p>
                <p className="correct-answer">
                  <strong>Best answer:</strong> {q.options[q.correctIndex]}
                </p>
                <p>{q.explanations[q.correctIndex]}</p>
                <label htmlFor={`note-${a.id}`}>
                  Your takeaway <span>optional</span>
                </label>
                <textarea
                  id={`note-${a.id}`}
                  maxLength={2000}
                  value={
                    state.notes.find((n) => n.id === `attempt:${a.id}`)?.text ||
                    ''
                  }
                  placeholder="What changed your thinking?"
                  onChange={(e) =>
                    saveTakeaway(`attempt:${a.id}`, a.conceptId, e.target.value)
                  }
                />
                <small>Saved as you type.</small>
                <button
                  className="text-link"
                  onClick={() => go(`learn/${a.conceptId}`)}
                >
                  Revisit the lesson <ArrowUpRight size={14} />
                </button>
              </div>
            </details>
          );
        })}
        {notes.map((n) => (
          <div key={n.id} className="manual-note">
            <span className="eyebrow">
              {shortTitle(n.conceptId)} · YOUR NOTE
            </span>
            <p>{n.text}</p>
            <button
              className="text-link"
              onClick={() => go(`learn/${n.conceptId}`)}
            >
              Open concept <ArrowUpRight size={13} />
            </button>
          </div>
        ))}
      </div>
      <div className="add-note">
        <div>
          <h3>Keep a takeaway from elsewhere.</h3>
          <p>Capture your own insight from a book or practice session.</p>
        </div>
        <TopicSelect
          value={noteConcept}
          onChange={setNoteConcept}
          label="Concept for your takeaway"
        />
        <label className="sr-only" htmlFor="manual-note">
          Personal takeaway
        </label>
        <textarea
          id="manual-note"
          maxLength={2000}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="In my own words…"
        />
        <button
          className="button outline"
          disabled={!manual.trim()}
          onClick={() => {
            saveTakeaway(uid(), noteConcept, manual);
            setManual('');
          }}
        >
          Save takeaway <Check size={15} />
        </button>
      </div>
    </div>
  );
}
function Backup({
  state,
  onRestore,
  saveAllowed,
}: {
  state: StudyState;
  onRestore: (s: StudyState) => void;
  saveAllowed: boolean;
}) {
  const account = useAccount();
  const { lessons, questions } = useCurriculum();
  const conceptIds = useMemo(() => lessons.map((l) => l.id), [lessons]);
  const [pending, setPending] = useState<StudyState | null>(null),
    [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const importSelection = useRef(0);
  function exportBackup() {
    const blob = new Blob(
        [
          JSON.stringify(
            { app: 'CISSP Buddy', exportedAt: new Date().toISOString(), state },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `cissp-buddy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Backup exported. Keep the file somewhere safe.');
  }
  async function importBackup(file: File | undefined) {
    const selection = ++importSelection.current;
    if (!file) return;
    setPending(null);
    try {
      if (file.size > 10000000)
        throw new Error(
          'This file is too large. Choose a CISSP Buddy JSON backup under 10 MB.',
        );
      const candidate = validateBackup(
        JSON.parse(await file.text()),
        conceptIds,
        questions,
      );
      if (selection !== importSelection.current) return;
      setPending(candidate);
      setMessage('');
    } catch (e) {
      if (selection !== importSelection.current) return;
      setMessage(
        e instanceof Error
          ? e.message
          : 'This backup could not be read. Your progress is unchanged.',
      );
    }
    if (input.current) input.current.value = '';
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR LEARNING, IN YOUR HANDS"
        title={
          <>
            Keep your progress.
            <br />
            <em>Take it with you.</em>
          </>
        }
        description={
          account.phase === 'owner'
            ? 'Export your signed-in account’s current pilot progress.'
            : 'Your lessons, practice history, and takeaways are stored in this browser.'
        }
      />
      <section className="backup-card">
        <ShieldCheck size={32} />
        <h2>
          {saveAllowed
            ? account.phase === 'owner'
              ? 'Your account progress'
              : 'Saved on this device'
            : 'Saving needs attention'}
        </h2>
        <p>
          {account.phase === 'owner'
            ? 'Your validated pilot record is saved to your account when the save status confirms it. Local backup replacement is available after signing out; it never replaces an existing account history.'
            : 'Guest progress stays in this browser. Export a backup to keep a copy or move it to another address.'}
        </p>
        <div className="backup-counts">
          <span>
            <strong>{state.completed.length}</strong> completed lessons
          </span>
          <span>
            <strong>{state.attempts.length}</strong> answers
          </span>
          <span>
            <strong>{state.notes.length}</strong> personal takeaways
          </span>
        </div>
        <div className="button-row">
          <button className="button" onClick={exportBackup}>
            <Download size={16} /> Export backup
          </button>
          <button
            className="button outline"
            onClick={() => input.current?.click()}
          >
            <Upload size={16} /> Import backup
          </button>
          <button
            className="button outline"
            onClick={() => {
              try {
                const raw = localStorage.getItem(STORAGE_KEY);
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify({ raw }, null, 2)], {
                    type: 'application/json',
                  }),
                );
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = 'cissp-pilot-stored-recovery.json';
                anchor.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setMessage(
                  'Untouched stored record exported for recovery. This is a recovery copy, not a validated progress backup.',
                );
              } catch {
                setMessage(
                  'The browser blocked access to stored records. Export backup to preserve current in-memory work.',
                );
              }
            }}
          >
            Export untouched stored record
          </button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Import progress backup"
            onChange={(e) => void importBackup(e.target.files?.[0])}
          />
        </div>
        {message && <output className="backup-message">{message}</output>}
      </section>
      <section className="coverage-note">
        <span className="eyebrow">ABOUT THIS PILOT</span>
        <h2>A focused foundation.</h2>
        <p>
          10 original lessons and 30 instructional scenarios explore identity
          and access, with connections to risk and asset classification. This is
          selected coverage of three domains, not a complete CISSP course or a
          readiness assessment.
        </p>
        <p>
          Explanations were AI source-checked against the references shown in
          each lesson. They have not been independently expert-reviewed. Use
          them alongside authoritative study material.
        </p>
        <a
          href="https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline"
          target="_blank"
          rel="noreferrer"
          className="text-link"
        >
          Official CISSP exam outline <ExternalLink size={14} />
        </a>
      </section>
      {pending && account.phase !== 'guest' && (
        <p className="notice">
          This valid local backup cannot replace existing account history. Sign
          out to restore it to guest learning, then explicitly copy it into an
          uninitialized account dataset.
        </p>
      )}
      <AlertDialog
        open={!!pending && account.phase === 'guest'}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Replace progress with this backup?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This backup contains {pending?.completed.length} completed
              lessons, {pending?.attempts.length} answers, and{' '}
              {pending?.notes.length} takeaways. It replaces the progress in
              this browser. Export your current progress first if you want to
              keep both copies.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current progress</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) {
                  try {
                    onRestore(pending);
                    setPending(null);
                    setMessage(
                      'Backup restored. Your learning history is ready.',
                    );
                  } catch {
                    setMessage(
                      'This browser could not write the backup. Current progress is unchanged; keep this page open and export it before trying again.',
                    );
                  }
                }
              }}
            >
              Restore backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
