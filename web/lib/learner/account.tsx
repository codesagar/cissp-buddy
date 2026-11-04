import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseRuntime } from './firebase';
import type { FirebaseRuntime } from './firebase';
import type { LearningDataset } from './hooks';
import { AccountControls } from '../../components/account-controls';
import '../../components/account-controls.css';

export type AccountState = {
  phase: 'checking' | 'guest' | 'owner' | 'unauthorized' | 'setup';
  runtime: FirebaseRuntime | null;
  user: User | null;
  configured: boolean;
  generation: number;
  issue: string;
  signInPending: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  setPending: (dataset: string, pending: boolean) => void;
  retryAccount: () => void;
};
const AccountContext = createContext<AccountState | null>(null);
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Account access is unavailable. Your browser progress is untouched.';
export function AccountProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AccountState['phase']>('checking');
  const [runtime, setRuntime] = useState<FirebaseRuntime | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [generation, setGeneration] = useState(0);
  const [issue, setIssue] = useState('');
  const [signInPending, setSignInPending] = useState(false);
  const signingIn = useRef(false);
  const [reload, setReload] = useState(0);
  const pending = useRef<Record<string, boolean>>({});
  const currentUid = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    getFirebaseRuntime()
      .then(async (next) => {
        if (cancelled) return;
        setRuntime(next);
        if (!next) {
          setPhase('guest');
          return;
        }
        const { onAuthStateChanged } = await import('firebase/auth');
        if (cancelled) return;
        unsubscribe = onAuthStateChanged(
          next.auth,
          (nextUser) => {
            if (cancelled) return;
            const previous = currentUid.current;
            const uid = nextUser?.uid ?? null;
            currentUid.current = uid;
            setGeneration((value) => value + 1);
            setUser(nextUser);
            setIssue('');
            pending.current = {};
            setPhase(
              !nextUser
                ? 'guest'
                : !next.ownerUid
                  ? 'setup'
                  : uid === next.ownerUid
                    ? 'owner'
                    : 'unauthorized',
            );
            if (previous && previous !== uid) {
              // A fresh document discards the memory-only database cache of the previous identity.
              window.location.reload();
            }
          },
          (error) => {
            if (cancelled) return;
            setIssue(errorText(error));
            setPhase('guest');
          },
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setIssue(errorText(error));
        setPhase('guest');
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [reload]);
  const setPending = useCallback((dataset: string, value: boolean) => {
    pending.current[dataset] = value;
  }, []);
  const signIn = useCallback(async () => {
    if (signingIn.current) return;
    signingIn.current = true;
    setSignInPending(true);
    setIssue('');
    try {
      const next = await getFirebaseRuntime();
      if (!next) throw Error('Cloud saving is not configured yet.');
      setRuntime(next);
      const { GoogleAuthProvider, signInWithPopup } =
        await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(next.auth, provider);
    } catch (error) {
      setIssue(
        `${errorText(error)} Retry sign-in when ready.`,
      );
    } finally {
      signingIn.current = false;
      setSignInPending(false);
    }
  }, []);
  const signOut = useCallback(
    async () => {
      if (Object.values(pending.current).some(Boolean)) {
        setIssue(
          'Account saving is unresolved. Keep this page open and retry saving before signing out.',
        );
        return;
      }
      try {
        if (!runtime) return;
        const { signOut: firebaseSignOut } = await import('firebase/auth');
        await firebaseSignOut(runtime.auth);
        window.location.reload();
      } catch (error) {
        setIssue(errorText(error));
      }
    },
    [runtime],
  );
  const retryAccount = useCallback(() => {
    setPhase('checking');
    setReload((value) => value + 1);
  }, []);
  const value = useMemo(
    () => ({
      phase,
      runtime,
      user,
      configured: !!runtime,
      generation,
      issue,
      signInPending,
      signIn,
      signOut,
      setPending,
      retryAccount,
    }),
    [
      phase,
      runtime,
      user,
      generation,
      issue,
      signInPending,
      signIn,
      signOut,
      setPending,
      retryAccount,
    ],
  );
  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}
export function useAccount() {
  const account = useContext(AccountContext);
  if (!account) throw Error('AccountProvider is missing.');
  return account;
}
export function LearnerAccountPanel<T>({
  learning,
  variant = 'panel',
}: {
  learning: LearningDataset<T>;
  variant?: 'panel' | 'toolbar';
}) {
  const account = useAccount();
  const [copyStatus, setCopyStatus] = useState('');
  const needsAttention =
    !!account.issue ||
    !!learning.issue ||
    account.phase === 'checking' ||
    account.phase === 'setup' ||
    account.phase === 'unauthorized' ||
    learning.status === 'loading' ||
    learning.status === 'offline' ||
    learning.status === 'error' ||
    learning.needsInitialization;
  return (
    <div
      className={
        variant === 'toolbar'
          ? `account-toolbar-host${needsAttention ? ' account-toolbar-attention' : ''}`
          : undefined
      }
    >
      <AccountControls
        variant={variant}
        phase={
          account.phase === 'owner' &&
          !learning.ready &&
          !learning.needsInitialization &&
          learning.status === 'loading'
            ? 'restoring'
            : account.phase
        }
        configured={account.configured}
        expanded={
          typeof window !== 'undefined' &&
          /^#\/backup(?:\/|$)/.test(window.location.hash)
        }
        attention={
          learning.needsInitialization
        }
        detailsContent={
          <>
            {copyStatus && (
              <output className="account-copy-status">{copyStatus}</output>
            )}
          </>
        }
        identity={account.user?.email || account.user?.displayName || undefined}
        accountId={account.user?.uid}
        status={learning.status}
        issue={account.issue || learning.issue}
        pending={learning.pending}
        signingIn={account.signInPending}
        onSignIn={() => void account.signIn()}
        onSignOut={() => void account.signOut()}
        onRetry={account.issue ? account.retryAccount : learning.retry}
        onCopyAccountId={
          account.user
            ? () => {
                const id = account.user!.uid;
                void (
                  navigator.clipboard?.writeText(id) ??
                  Promise.reject(Error('Clipboard unavailable'))
                )
                  .then(() => setCopyStatus('Account ID copied.'))
                  .catch(() =>
                    setCopyStatus(
                      'Clipboard access was blocked. Select and copy the displayed account ID.',
                    ),
                  );
              }
            : undefined
        }
      />
      {account.phase === 'owner' && learning.needsInitialization && (
        <section className="account-controls" role="alert">
          <h2>Learning needs attention</h2>
          <p>Saved work has been preserved. Check your connection and retry; your account history will not be overwritten.</p>
          {learning.incompleteImport ? (
            <button type="button" onClick={() => void learning.startFresh()}>Retry account setup</button>
          ) : (
            <button type="button" onClick={learning.retry}>Try again</button>
          )}
        </section>
      )}
    </div>
  );
}
