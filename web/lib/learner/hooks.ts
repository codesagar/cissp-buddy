import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useAccount } from './account';
import type { Dataset } from './cloud-store';
import type { AccountSaveStatus } from '../../components/account-controls';

type Options<T> = {
  dataset: Dataset;
  empty: () => T;
  validate: (raw: unknown) => T;
  checkpoint?: string;
};
type View<T> = {
  key: string;
  state: T;
  ready: boolean;
  issue: string;
  initialized: boolean;
  needsInitialization: boolean;
  incompleteImport: boolean;
  recovery: boolean;
};
export type LearningDataset<T> = {
  dataset: Dataset;
  state: T;
  setState: Dispatch<SetStateAction<T>>;
  ready: boolean;
  issue: string;
  status: AccountSaveStatus;
  pending: boolean;
  initialized: boolean;
  needsInitialization: boolean;
  incompleteImport: boolean;
  isAccount: boolean;
  retry: () => void;
  startFresh: () => Promise<void>;
};
/** Timer-only changes are checkpointed; answer, phase, selection and evidence changes are not filtered out. */
export function checkpointSignature(dataset: Dataset, state: unknown): string {
  if (dataset !== 'pilot' || !state || typeof state !== 'object')
    return JSON.stringify(state);
  const pilot = state as { active?: Record<string, unknown> | null };
  return JSON.stringify({
    ...pilot,
    active: pilot.active
      ? { ...pilot.active, elapsedMs: 0, phaseMs: 0 }
      : pilot.active,
  });
}
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Account storage could not be reached. Your current work is retained.';
export function useLearningDataset<T>({
  dataset,
  empty,
  validate,
  checkpoint = '',
}: Options<T>): LearningDataset<T> {
  const account = useAccount();
  const setAccountPending = account.setPending;
  const owner =
    account.phase === 'owner' && !!account.runtime && !!account.user;
  const key = owner
    ? `${account.runtime!.projectId}:${account.user!.uid}:${dataset}:${account.generation}`
    : account.phase === 'guest'
      ? `guest:${dataset}:${account.generation}`
      : `blocked:${dataset}:${account.generation}`;
  const [view, setView] = useState<View<T>>(() => ({
    key: '',
    state: empty(),
    ready: false,
    issue: '',
    initialized: false,
    needsInitialization: false,
    incompleteImport: false,
    recovery: false,
  }));
  const [status, setStatus] = useState<AccountSaveStatus>('loading');
  const [pending, setPending] = useState(false);
  const [loadNonce, setLoadNonce] = useState(0);
  const [savePulse, setSavePulse] = useState(0);
  const current = useRef(view);
  const currentKey = useRef(key);
  useLayoutEffect(() => {
    current.current = view;
    currentKey.current = key;
  }, [view, key]);
  const previousCheckpoint = useRef(checkpoint);
  const cloud = useRef<T | null>(null);
  const base = useRef<T | null>(null);
  const blocked = useRef(false);
  const saving = useRef(false);
  const failedSave = useRef(false);
  const lastSaveAt = useRef(0);
  const epoch = useRef(0);
  const validForKey = view.key === key;
  const visibleState = validForKey ? view.state : empty();
  const updateIssue = useCallback(
    (text: string) =>
      setView((old) =>
        old.key === currentKey.current ? { ...old, issue: text } : old,
      ),
    [],
  );

  useEffect(() => {
    const token = ++epoch.current;
    let cancelled = false;
    cloud.current = null;
    base.current = null;
    blocked.current = true;
    saving.current = false;
    failedSave.current = false;
    if (account.phase !== 'guest' && !owner) return;
    const active = () =>
      !cancelled && epoch.current === token && currentKey.current === key;
    void Promise.resolve().then(async () => {
      if (!active()) return;
      setPending(false);
      setStatus('loading');
      setView({
        key,
        state: empty(),
        ready: false,
        issue: '',
        initialized: false,
        needsInitialization: false,
        incompleteImport: false,
        recovery: false,
      });
      const guestIssue = '';
      if (!owner) {
        if (!active()) return;
        blocked.current = true;
        setView({ key, state: empty(), ready: false, issue: '', initialized: false, needsInitialization: false, incompleteImport: false, recovery: false });
        setStatus('loading');
        return;
      }
      let attemptedEmptyInitialization = false;
      try {
        const { loadDataset, adoptDataset } = await import('./cloud-store');
        let loaded = await loadDataset(
          account.runtime!.db,
          account.user!.uid,
          dataset,
          validate,
        );
        if (!active()) return;
        // Only create a new account dataset when there is no existing work to
        // reconcile. The transaction refuses to overwrite concurrent creation.
        if (!loaded) {
          attemptedEmptyInitialization = true;
          loaded = await adoptDataset(
            account.runtime!.db,
            account.user!.uid,
            dataset,
            validate(empty()),
            validate,
          );
          if (!active()) return;
        }
        cloud.current = loaded;
        base.current = loaded;
        lastSaveAt.current = Date.now();
        blocked.current = false;
        setView({
          key,
          state: loaded || empty(),
          ready: loaded !== null,
          issue: guestIssue,
          initialized: loaded !== null,
          needsInitialization: loaded === null,
          incompleteImport: false,
          recovery: false,
        });
        setStatus(loaded ? 'saved' : 'loading');
      } catch (error) {
        if (!active()) return;
        if (attemptedEmptyInitialization) {
          try {
            const { loadDataset } = await import('./cloud-store');
            const winner = await loadDataset(
              account.runtime!.db,
              account.user!.uid,
              dataset,
              validate,
            );
            if (!active()) return;
            if (winner) {
              cloud.current = winner;
              base.current = winner;
              lastSaveAt.current = Date.now();
              blocked.current = false;
              setView({ key, state: winner, ready: true, issue: '', initialized: true, needsInitialization: false, incompleteImport: false, recovery: false });
              setStatus('saved');
              return;
            }
          } catch {
            // Keep the original initialization error below; reload is only a
            // recovery attempt and must never mask the cause of failure.
          }
        }
        const incomplete =
          error instanceof Error && error.name === 'IncompleteImportError';
        setView({
          key,
          state: empty(),
          ready: false,
          issue: message(error),
          initialized: false,
          needsInitialization: incomplete,
          incompleteImport: incomplete,
          recovery: false,
        });
        setStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    key,
    loadNonce,
    account.phase,
    owner,
    account.runtime,
    account.user,
    dataset,
      empty,
    validate,
  ]);

  const setState: Dispatch<SetStateAction<T>> = useCallback(
    (next) => {
      const expectedKey = key;
      setView((old) => {
        if (
          old.key !== expectedKey ||
          currentKey.current !== expectedKey ||
          !old.ready
        )
          return old;
        const nextState =
          typeof next === 'function'
            ? (next as (previous: T) => T)(old.state)
            : next;
        return { ...old, state: nextState };
      });
    },
    [key],
  );
  const flush = useCallback(async () => {
    if (
      !owner ||
      saving.current ||
      blocked.current ||
      failedSave.current ||
      current.current.key !== key ||
      !current.current.ready ||
      !base.current
    )
      return;
    let target: T;
    try {
      target = validate(current.current.state);
    } catch (error) {
      failedSave.current = true;
      setPending(true);
      setStatus('error');
      updateIssue(message(error));
      return;
    }
    if (JSON.stringify(target) === JSON.stringify(base.current)) {
      setPending(false);
      setStatus('saved');
      return;
    }
    const previous = base.current;
    const token = epoch.current;
    saving.current = true;
    setPending(true);
    setStatus(navigator.onLine ? 'saving' : 'offline');
    try {
      const { saveDataset } = await import('./cloud-store');
      await saveDataset(
        account.runtime!.db,
        account.user!.uid,
        dataset,
        previous,
        target,
        validate,
      );
      if (epoch.current !== token || currentKey.current !== key) return;
      base.current = target;
      cloud.current = target;
      lastSaveAt.current = Date.now();
      const changedAgain =
        checkpointSignature(dataset, current.current.state) !==
        checkpointSignature(dataset, target);
      setPending(changedAgain);
      setStatus(changedAgain ? 'saving' : 'saved');
      updateIssue('');
    } catch (error) {
      if (epoch.current !== token || currentKey.current !== key) return;
      failedSave.current = true;
      setPending(true);
      setStatus('error');
      updateIssue(
        `${message(error)} Keep this page open and retry saving.`,
      );
    } finally {
      if (epoch.current === token && currentKey.current === key) {
        saving.current = false;
        setSavePulse((value) => value + 1);
      }
    }
  }, [
    owner,
    key,
    validate,
    account.runtime,
    account.user,
    dataset,
    updateIssue,
  ]);

  useEffect(() => {
    if (!validForKey || !view.ready || blocked.current) return;
    if (!owner) {
      return;
    }
    if (
      !base.current ||
      JSON.stringify(view.state) === JSON.stringify(base.current)
    )
      return;
    const timerOnly =
      checkpointSignature(dataset, view.state) ===
      checkpointSignature(dataset, base.current);
    if (!timerOnly)
      queueMicrotask(() => {
        if (currentKey.current === key) setPending(true);
      });
    if (failedSave.current || saving.current) return;
    const routeChanged = previousCheckpoint.current !== checkpoint;
    previousCheckpoint.current = checkpoint;
    const delay =
      !routeChanged && timerOnly
        ? Math.max(0, 15_000 - (Date.now() - lastSaveAt.current))
        : 350;
    const timeout = setTimeout(() => void flush(), delay);
    return () => clearTimeout(timeout);
  }, [
    view.state,
    view.ready,
    key,
    validForKey,
    owner,
    account.phase,
      dataset,
    checkpoint,
    savePulse,
    flush,
    updateIssue,
  ]);
  useEffect(() => {
    if (!owner || !pending) return;
    const beforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeLeave);
    return () => window.removeEventListener('beforeunload', beforeLeave);
  }, [owner, pending]);
  useEffect(() => {
    setAccountPending(dataset, owner && pending);
    return () => setAccountPending(dataset, false);
  }, [setAccountPending, dataset, owner, pending]);

  const retry = useCallback(() => {
    if (failedSave.current) {
      failedSave.current = false;
      updateIssue('');
      void flush();
    } else setLoadNonce((value) => value + 1);
  }, [flush, updateIssue]);
  const adopt = useCallback(
    async (source: T) => {
      if (
        !owner ||
        currentKey.current !== key ||
        !current.current.needsInitialization ||
        saving.current
      )
        return;
      const validated = validate(source);
      const token = epoch.current;
      saving.current = true;
      setPending(true);
      setStatus('saving');
      updateIssue('');
      try {
        const { adoptDataset } = await import('./cloud-store');
        const result = await adoptDataset(
          account.runtime!.db,
          account.user!.uid,
          dataset,
          validated,
          validate,
        );
        if (epoch.current !== token || currentKey.current !== key) return;
        base.current = result;
        cloud.current = result;
        blocked.current = false;
        lastSaveAt.current = Date.now();
        setView({
          key,
          state: result,
          ready: true,
          issue: '',
          initialized: true,
          needsInitialization: false,
          incompleteImport: false,
          recovery: false,
        });
        setPending(false);
        setStatus('saved');
      } catch (error) {
        if (epoch.current !== token || currentKey.current !== key) return;
        setView((old) => ({
          ...old,
          state: validated,
          ready: false,
          issue: `${message(error)} Retry account setup.`,
          incompleteImport: true,
          needsInitialization: true,
        }));
        setPending(true);
        setStatus('error');
      } finally {
        if (epoch.current === token) saving.current = false;
      }
    },
    [
      owner,
      validate,
      account.runtime,
      account.user,
      dataset,
      key,
        updateIssue,
    ],
  );
  const startFresh = useCallback(async () => {
    await adopt(empty());
  }, [adopt, empty]);
  return {
    dataset,
    state: visibleState,
    setState,
    ready: validForKey && view.ready,
    issue: validForKey ? view.issue : '',
    status: validForKey && pending && status === 'saved' ? 'saving' : status,
    pending: validForKey && pending,
    initialized: validForKey && view.initialized,
    needsInitialization: validForKey && view.needsInitialization,
    incompleteImport: validForKey && view.incompleteImport,
    isAccount: owner,
    retry,
    startFresh,
  };
}
