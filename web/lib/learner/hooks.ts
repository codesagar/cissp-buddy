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
  legacyKey: string;
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
  hasLocalRecovery: boolean;
  hasGuestData: boolean;
  hasInitialCopy: boolean;
  cacheNeedsReplacement: boolean;
  exportUntouchedRecovery: () => void;
  replaceRecoveryCopy: () => void;
  isAccount: boolean;
  retry: () => void;
  exportCurrent: () => void;
  exportGuest: () => void;
  adoptGuest: () => Promise<void>;
  startFresh: () => Promise<void>;
  useCloudCopy: () => void;
  restore: (next: T) => void;
  replaceLocal: (next: T) => void;
  protectStoredRecords: (message: string) => void;
};
export function downloadProgress(name: string, state: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
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
export type AccountRecovery<T> =
  | { kind: 'missing' }
  | { kind: 'valid'; state: T; dirty: boolean }
  | { kind: 'unreadable' };
export function readAccountRecovery<T>(
  storage: Pick<Storage, 'getItem'>,
  key: string,
  validate: (raw: unknown) => T,
): AccountRecovery<T> {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return { kind: 'missing' };
    const value = JSON.parse(raw);
    if (value.version !== 1 || typeof value.dirty !== 'boolean')
      return { kind: 'unreadable' };
    return { kind: 'valid', state: validate(value.state), dirty: value.dirty };
  } catch {
    return { kind: 'unreadable' };
  }
}
export function writeAccountRecovery<T>(
  storage: Pick<Storage, 'setItem'>,
  key: string,
  state: T,
  dirty: boolean,
  validate: (raw: unknown) => T,
  unreadable: boolean,
  explicitReplacement = false,
) {
  if (unreadable && !explicitReplacement) return false;
  const candidate = validate(state);
  storage.setItem(key, JSON.stringify({ version: 1, state: candidate, dirty }));
  return true;
}
const cachePrefix = 'cissp-buddy:account:';
export function useLearningDataset<T>({
  dataset,
  legacyKey,
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
  const cacheKey = owner
    ? `${cachePrefix}${account.runtime!.projectId}:${account.user!.uid}:${dataset}:v1`
    : '';
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
  const [hasGuestData, setHasGuestData] = useState(false);
  const [hasInitialCopy, setHasInitialCopy] = useState(false);
  const [cacheNeedsReplacement, setCacheNeedsReplacement] = useState(false);
  const unreadableCache = useRef(false);
  const previousCheckpoint = useRef(checkpoint);
  const guest = useRef<T | null>(null);
  const adoptionSource = useRef<T | null>(null);
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
  const persistCache = useCallback(
    (state: T, dirty: boolean) => {
      if (!owner || !account.remember || !cacheKey) return;
      try {
        writeAccountRecovery(
          localStorage,
          cacheKey,
          state,
          dirty,
          validate,
          unreadableCache.current,
        );
      } catch {
        updateIssue(
          'This browser could not retain a recovery copy. Keep the page open and export before leaving.',
        );
      }
    },
    [owner, account.remember, cacheKey, validate, updateIssue],
  );

  useEffect(() => {
    const token = ++epoch.current;
    let cancelled = false;
    guest.current = null;
    if (current.current.key !== key) adoptionSource.current = null;
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
      setHasGuestData(false);
      setHasInitialCopy(false);
      unreadableCache.current = false;
      setCacheNeedsReplacement(false);
      let guestIssue = '';
      try {
        const raw = localStorage.getItem(legacyKey);
        if (raw) guest.current = validate(JSON.parse(raw));
      } catch {
        guestIssue =
          'The browser guest record could not be read. It is preserved; use untouched-record export before replacing it.';
      }
      const guestAvailable =
        guest.current !== null &&
        JSON.stringify(guest.current) !== JSON.stringify(empty());
      setHasGuestData(guestAvailable);
      setHasInitialCopy(adoptionSource.current !== null || guestAvailable);
      if (!owner) {
        if (!active()) return;
        blocked.current = true;
        setView({
          key,
          state: guest.current || empty(),
          ready: false,
          issue: guestIssue,
          initialized: true,
          needsInitialization: false,
          incompleteImport: false,
          recovery: false,
        });
        setStatus('loading');
        return;
      }
      let cached: { state: T; dirty: boolean } | null = null;
      if (account.remember) {
        const recovery = readAccountRecovery(localStorage, cacheKey, validate);
        if (recovery.kind === 'valid') cached = recovery;
        if (recovery.kind === 'unreadable') {
          unreadableCache.current = true;
          setCacheNeedsReplacement(true);
          guestIssue =
            'The account recovery copy on this device is unreadable and preserved. Export its untouched record before explicitly replacing it.';
        }
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
        if (!loaded && !guestAvailable && !guestIssue && !cached && !unreadableCache.current) {
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
        if (cached?.dirty) {
          adoptionSource.current = cached.state;
          setHasInitialCopy(true);
          setView({
            key,
            state: cached.state,
            ready: false,
            issue:
              'Unconfirmed device work is retained. Export it before using the saved account copy.',
            initialized: loaded !== null,
            needsInitialization: loaded === null,
            incompleteImport: false,
            recovery: true,
          });
          blocked.current = true;
          setPending(true);
          setStatus('error');
          return;
        }
        if (!loaded && cached) {
          adoptionSource.current = cached.state;
          setHasInitialCopy(true);
        }
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
        if (loaded) persistCache(loaded, false);
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
              persistCache(winner, false);
              return;
            }
          } catch {
            // Keep the original initialization error below; reload is only a
            // recovery attempt and must never mask the cause of failure.
          }
        }
        const incomplete =
          error instanceof Error && error.name === 'IncompleteImportError';
        if (cached) {
          adoptionSource.current = cached.state;
          setHasInitialCopy(true);
        }
        setView({
          key,
          state: cached?.state || empty(),
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
    account.remember,
    cacheKey,
    dataset,
    legacyKey,
    empty,
    validate,
    persistCache,
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
      persistCache(current.current.state, changedAgain);
      setPending(changedAgain);
      setStatus(changedAgain ? 'saving' : 'saved');
      updateIssue(
        unreadableCache.current
          ? 'The unreadable device recovery copy is preserved. Export or explicitly replace it below.'
          : '',
      );
    } catch (error) {
      if (epoch.current !== token || currentKey.current !== key) return;
      failedSave.current = true;
      setPending(true);
      setStatus('error');
      updateIssue(
        `${message(error)} Export your current work before leaving, then retry.`,
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
    persistCache,
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
    persistCache(view.state, !timerOnly);
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
    legacyKey,
    dataset,
    checkpoint,
    savePulse,
    flush,
    persistCache,
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
  useEffect(() => {
    if (owner || account.phase !== 'guest') return;
    const sync = (event: StorageEvent) => {
      if (event.key !== legacyKey || !event.newValue) return;
      try {
        const next = validate(JSON.parse(event.newValue));
        setView((old) => (old.key === key ? { ...old, state: next } : old));
      } catch {
        blocked.current = true;
        updateIssue(
          'Another tab saved unreadable guest progress. Saving is paused to preserve it. Export current and untouched records before restoring a valid backup.',
        );
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [owner, account.phase, legacyKey, validate, key, updateIssue]);

  const retry = useCallback(() => {
    if (failedSave.current) {
      failedSave.current = false;
      updateIssue('');
      void flush();
    } else setLoadNonce((value) => value + 1);
  }, [flush, updateIssue]);
  const exportCurrent = useCallback(
    () =>
      downloadProgress(
        `cissp-${dataset}-progress.json`,
        current.current.key === key ? current.current.state : empty(),
      ),
    [dataset, key, empty],
  );
  const exportGuest = useCallback(() => {
    if (guest.current)
      downloadProgress(`cissp-${dataset}-guest-progress.json`, guest.current);
  }, [dataset]);
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
      adoptionSource.current = validated;
      persistCache(validated, true);
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
        adoptionSource.current = null;
        blocked.current = false;
        lastSaveAt.current = Date.now();
        persistCache(result, false);
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
          issue: `${message(error)} Keep the same source backup to resume this initial copy.`,
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
      persistCache,
      updateIssue,
    ],
  );
  const adoptGuest = useCallback(async () => {
    const source = adoptionSource.current || guest.current;
    if (source) await adopt(source);
  }, [adopt]);
  const startFresh = useCallback(async () => {
    await adopt(empty());
  }, [adopt, empty]);
  const useCloudCopy = useCallback(() => {
    if (!cloud.current || current.current.key !== key) return;
    blocked.current = false;
    failedSave.current = false;
    adoptionSource.current = null;
    const next = cloud.current;
    base.current = next;
    persistCache(next, false);
    setView({
      key,
      state: next,
      ready: true,
      issue: '',
      initialized: true,
      needsInitialization: false,
      incompleteImport: false,
      recovery: false,
    });
    setPending(false);
    setStatus('saved');
  }, [key, persistCache]);
  const restore = useCallback(
    (next: T) => {
      if (owner || account.phase !== 'guest')
        throw Error(
          'A local backup cannot replace existing account progress. Sign out to restore a guest backup, then explicitly copy into an uninitialized account dataset.',
        );
      const validated = validate(next);
      blocked.current = true;
      setView((old) => ({ ...old, state: validated, issue: '', ready: false }));
      setStatus('loading');
    },
    [owner, account.phase, validate],
  );
  const replaceLocal = useCallback(
    (next: T) => {
      if (owner || account.phase !== 'guest')
        throw Error(
          'Account history is not replaced by a local backup. Restore to guest learning after signing out.',
        );
      const validated = validate(next);
      localStorage.setItem(legacyKey, JSON.stringify(validated));
      restore(validated);
    },
    [owner, account.phase, validate, legacyKey, restore],
  );
  const protectStoredRecords = useCallback(
    (text: string) => {
      blocked.current = true;
      updateIssue(text);
    },
    [updateIssue],
  );
  const exportUntouchedRecovery = useCallback(() => {
    if (!owner || currentKey.current !== key) return;
    try {
      downloadProgress(`cissp-${dataset}-untouched-account-recovery.json`, {
        format: 'cissp-buddy-account-recovery-raw-v1',
        projectId: account.runtime!.projectId,
        uid: account.user!.uid,
        dataset,
        raw: localStorage.getItem(cacheKey),
      });
    } catch {
      updateIssue(
        'The browser blocked access to the untouched recovery record. It remains preserved; export current progress separately.',
      );
    }
  }, [
    owner,
    key,
    dataset,
    account.runtime,
    account.user,
    cacheKey,
    updateIssue,
  ]);
  const replaceRecoveryCopy = useCallback(() => {
    if (
      !owner ||
      currentKey.current !== key ||
      !current.current.ready ||
      pending
    )
      return;
    try {
      const next = validate(current.current.state);
      const dirty =
        base.current === null ||
        checkpointSignature(dataset, next) !==
          checkpointSignature(dataset, base.current);
      writeAccountRecovery(
        localStorage,
        cacheKey,
        next,
        dirty,
        validate,
        true,
        true,
      );
      unreadableCache.current = false;
      setCacheNeedsReplacement(false);
      updateIssue('');
    } catch {
      updateIssue(
        'The browser could not replace the device copy. Its original record remains untouched.',
      );
    }
  }, [owner, key, pending, validate, dataset, cacheKey, updateIssue]);
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
    hasLocalRecovery: validForKey && view.recovery,
    hasGuestData,
    hasInitialCopy,
    cacheNeedsReplacement: validForKey && cacheNeedsReplacement,
    exportUntouchedRecovery,
    replaceRecoveryCopy,
    isAccount: owner,
    retry,
    exportCurrent,
    exportGuest,
    adoptGuest,
    startFresh,
    useCloudCopy,
    restore,
    replaceLocal,
    protectStoredRecords,
  };
}
