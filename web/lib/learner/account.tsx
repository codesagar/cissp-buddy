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

const REMEMBER_KEY = 'cissp-buddy:remember:v1';
export type AccountState = {
  phase: 'checking' | 'guest' | 'owner' | 'unauthorized' | 'setup';
  runtime: FirebaseRuntime | null;
  user: User | null;
  configured: boolean;
  remember: boolean;
  generation: number;
  issue: string;
  signInPending: boolean;
  signIn: () => Promise<void>;
  signOut: (leaveUnconfirmed?: boolean) => Promise<void>;
  setRemember: (value: boolean) => void;
  setPending: (dataset: string, pending: boolean) => void;
  retryAccount: () => void;
};
const AccountContext = createContext<AccountState | null>(null);
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Account access is unavailable. Your browser progress is untouched.';
function remembered() {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== 'false';
  } catch {
    return true;
  }
}
export function AccountProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AccountState['phase']>('checking');
  const [runtime, setRuntime] = useState<FirebaseRuntime | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [remember, rememberState] = useState(remembered);
  const [generation, setGeneration] = useState(0);
  const [issue, setIssue] = useState('');
  const [signInPending, setSignInPending] = useState(false);
  const signingIn = useRef(false);
  const [reload, setReload] = useState(0);
  const pending = useRef<Record<string, boolean>>({});
  const currentUid = useRef<string | null>(null);
  const rememberRef = useRef(remember);
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    getFirebaseRuntime(rememberRef.current)
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
  const setRemember = useCallback((value: boolean) => {
    rememberRef.current = value;
    rememberState(value);
    try {
      localStorage.setItem(REMEMBER_KEY, String(value));
    } catch {
      setIssue(
        'This browser could not remember the device choice. Account records remain private.',
      );
    }
  }, []);
  const setPending = useCallback((dataset: string, value: boolean) => {
    pending.current[dataset] = value;
  }, []);
  const signIn = useCallback(async () => {
    if (signingIn.current) return;
    signingIn.current = true;
    setSignInPending(true);
    setIssue('');
    try {
      const next = await getFirebaseRuntime(rememberRef.current);
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
    async (leaveUnconfirmed = false) => {
      if (!leaveUnconfirmed && Object.values(pending.current).some(Boolean)) {
        setIssue(
          'Account saving is unresolved. Pause practice, retry saving or export your work before signing out.',
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
      remember,
      generation,
      issue,
      signInPending,
      signIn,
      signOut,
      setRemember,
      setPending,
      retryAccount,
    }),
    [
      phase,
      runtime,
      user,
      remember,
      generation,
      issue,
      signInPending,
      signIn,
      signOut,
      setRemember,
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
    learning.needsInitialization ||
    learning.hasLocalRecovery ||
    learning.cacheNeedsReplacement;
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
          !learning.hasLocalRecovery &&
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
          learning.needsInitialization ||
          learning.hasLocalRecovery ||
          learning.cacheNeedsReplacement
        }
        detailsContent={
          <>
            {account.phase === 'owner' && account.remember && (
              <p className="account-device-notice">
                Personal-device recovery copies remain in this browser after
                sign-out. Sign-out removes your account session and active view;
                it does not securely erase those copies. Export unconfirmed work
                before clearing browser site data.
              </p>
            )}
            {copyStatus && (
              <output className="account-copy-status">{copyStatus}</output>
            )}
            {account.phase === 'owner' && learning.pending && (
              <div className="account-leave-actions">
                <p>
                  If you need to leave before account saving finishes, export
                  the current record and keep the download. Account storage may
                  still be incomplete.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    learning.exportCurrent();
                    void account.signOut(true);
                  }}
                >
                  Export backup and sign out
                </button>
              </div>
            )}
            {account.phase === 'owner' &&
              learning.ready &&
              learning.hasGuestData && (
                <div className="account-guest-copy">
                  <button type="button" onClick={learning.exportGuest}>
                    Export separate browser guest progress
                  </button>
                </div>
              )}
          </>
        }
        identity={account.user?.email || account.user?.displayName || undefined}
        accountId={account.user?.uid}
        remember={account.remember}
        status={learning.status}
        issue={account.issue || learning.issue}
        pending={learning.pending}
        signingIn={account.signInPending}
        onRemember={account.setRemember}
        onSignIn={() => void account.signIn()}
        onSignOut={() => void account.signOut()}
        onRetry={account.issue ? account.retryAccount : learning.retry}
        onExport={account.phase === 'owner' ? learning.exportCurrent : undefined}
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
      {account.phase === 'owner' && learning.cacheNeedsReplacement && (
        <section className="account-controls">
          <h2>Preserved device recovery copy</h2>
          <p>
            The existing device copy could not be validated. It is not
            overwritten by account loading or automatic saving. Export it before
            selecting a valid replacement.
          </p>
          <button type="button" onClick={learning.exportUntouchedRecovery}>
            Export untouched account recovery copy
          </button>
          {learning.ready && (
            <button
              type="button"
              disabled={learning.pending}
              onClick={learning.replaceRecoveryCopy}
            >
              Replace device copy with current validated progress
            </button>
          )}
        </section>
      )}
      {account.phase === 'owner' && learning.needsInitialization && (
        <section className="account-controls account-adoption">
          <h2>
            {learning.incompleteImport
              ? 'Finish the initial account copy'
              : `Choose your ${learning.dataset === 'course' ? 'course' : 'pilot'} starting point`}
          </h2>
          <p>
            Your browser’s guest record is separate. Nothing is copied into this
            account automatically.
          </p>
          {learning.hasInitialCopy && (
            <button
              type="button"
              disabled={
                learning.status === 'saving' || learning.status === 'offline'
              }
              onClick={() => void learning.adoptGuest()}
            >
              Copy this browser’s{' '}
              {learning.dataset === 'course' ? 'course' : 'pilot'} progress to
              my account
            </button>
          )}
          {(!learning.incompleteImport || !learning.hasInitialCopy) &&
            !learning.hasLocalRecovery && (
              <button
                type="button"
                disabled={
                  learning.status === 'saving' || learning.status === 'offline'
                }
                onClick={() => void learning.startFresh()}
              >
                {learning.incompleteImport
                  ? 'Resume an empty starting point'
                  : 'Start fresh account progress'}
              </button>
            )}
          <p>
            To use an existing backup, sign out, restore it to local guest
            learning, then sign in and explicitly copy that record. Existing
            account history is never replaced by a local backup.
          </p>
        </section>
      )}
      {account.phase === 'owner' && learning.hasLocalRecovery && (
        <section className="account-controls account-adoption">
          <h2>Unconfirmed work is saved on this device</h2>
          <p>
            Export it before choosing the saved account copy or completing
            initial account setup. Your unconfirmed record has not been uploaded
            or silently replaced.
          </p>
          <button type="button" onClick={learning.exportCurrent}>
            Export unconfirmed progress
          </button>
          {learning.initialized && (
            <button type="button" onClick={learning.useCloudCopy}>
              Use the saved account copy
            </button>
          )}
        </section>
      )}
    </div>
  );
}
