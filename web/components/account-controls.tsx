import { useId } from 'react';
import type { ReactNode } from 'react';

/** Presentational account state; the account hook owns identity and storage. */
export type AccountPhase =
  | 'guest'
  | 'checking'
  | 'restoring'
  | 'owner'
  | 'unauthorized'
  | 'setup';
export type AccountSaveStatus =
  | 'local'
  | 'loading'
  | 'saving'
  | 'saved'
  | 'offline'
  | 'error';
export type AccountControlsProps = {
  phase: AccountPhase;
  variant?: 'panel' | 'toolbar';
  configured: boolean;
  identity?: string;
  accountId?: string;
  status: AccountSaveStatus;
  issue?: string;
  pending: boolean;
  signingIn?: boolean;
  /** Keep recovery or initial setup fully visible instead of collapsing it. */
  attention?: boolean;
  expanded?: boolean;
  detailsContent?: ReactNode;
  onSignIn: () => void;
  onSignOut: () => void;
  onRetry?: () => void;
  onCopyAccountId?: () => void;
};
const labels: Record<AccountSaveStatus, string> = {
  local: 'Sign in to save your learning',
  loading: 'Restoring account progress…',
  saving: 'Saving to your account…',
  saved: 'Saved to your account',
  offline: 'Offline — account save is pending',
  error: 'Account save needs attention',
};
export function AccountControls({
  phase,
  variant = 'panel',
  configured,
  identity,
  accountId,
  status,
  issue,
  pending,
  signingIn = false,
  attention = false,
  expanded = false,
  detailsContent,
  onSignIn,
  onSignOut,
  onRetry,
  onCopyAccountId,
}: AccountControlsProps) {
  const id = useId();
  const checking = phase === 'checking' || phase === 'restoring';
  const signedIn =
    phase === 'owner' || phase === 'unauthorized' || phase === 'setup';
  const title = checking
    ? 'Opening your account'
    : phase === 'owner'
      ? 'Your learning account'
      : signedIn
        ? 'Account access'
        : 'Save your learning';
  const needsAttention =
    attention ||
    phase === 'guest' ||
    checking ||
    !!issue ||
    phase === 'unauthorized' ||
    phase === 'setup' ||
    status === 'offline' ||
    status === 'error';
  const toolbar = variant === 'toolbar';
  const summary =
    toolbar && !needsAttention ? (
      <span className="account-summary-content">
        <span id={`${id}-heading`} className="account-summary-title">
          <span className="account-toolbar-title-desktop">
            {phase === 'owner' ? identity || 'Account' : 'Account'}
          </span>
          <span className="account-toolbar-title-mobile">
            {signingIn
              ? 'Signing in…'
              : phase === 'owner' && (pending || status === 'saving')
                ? 'Saving…'
                : 'Account'}
          </span>
        </span>
        <span className="account-save-status">
          {phase === 'owner' ? labels[status] : 'Sign in to save your learning'}
        </span>
      </span>
    ) : (
      <h2 className="account-summary-content">
        <span id={`${id}-heading`} className="account-summary-title">
          {title}
        </span>
        {signedIn && identity && (
          <span className="account-identity">{identity}</span>
        )}
        {checking && (
          <output>Restoring your identity and saved progress…</output>
        )}
        {phase === 'guest' && (
          <span className="account-save-status">Sign in to save your learning</span>
        )}
        {phase === 'owner' && (
          <output className="account-save-status">{labels[status]}</output>
        )}
        {!needsAttention && (
          <span className="account-disclosure-label">
            Account options
          </span>
        )}
      </h2>
    );
  const content = (
    <div className="account-details-content">
      <div className="account-controls-heading">
        <div>
          {phase === 'guest' && (
            <p>
              {configured
                ? 'Sign in with Google to save and resume your learning across devices.'
                : 'Google sign-in is currently unavailable. Please try again later.'}
            </p>
          )}
          {phase === 'unauthorized' && (
            <p role="alert">
              This Google account is not enabled for private learning records.
              No account progress has been loaded or copied.
            </p>
          )}
          {phase === 'setup' && (
            <div className="account-setup">
              <p>
                Sign-in worked. Private saving stays disabled until this account
                is authorized.
              </p>
              {accountId && (
                <p>
                  Your setup account ID: <code>{accountId}</code>
                </p>
              )}
              {onCopyAccountId && (
                <button type="button" onClick={onCopyAccountId}>
                  Copy account ID
                </button>
              )}
            </div>
          )}
        </div>
        {phase === 'guest' && configured && (
          <div className="account-signin-actions">
            <button
              type="button"
              onClick={onSignIn}
              disabled={signingIn}
              aria-busy={signingIn}
            >
              {signingIn ? 'Signing in…' : 'Sign in with Google'}
            </button>
            {signingIn && (
              <output>
                Signing in with Google. Complete the Google sign-in window to
                continue.
              </output>
            )}
          </div>
        )}
        {signedIn && (
          <button type="button" onClick={onSignOut} disabled={pending}>
            Sign out
          </button>
        )}
      </div>
      {pending && (
        <output className="account-pending">
          Your latest changes have not been confirmed in account storage. Keep
          this page open and retry account saving before signing out.
        </output>
      )}
      {issue && (
        <p className="account-issue" role="alert">
          {issue}
        </p>
      )}
      {onRetry && (
        <div className="account-recovery-actions">
          {onRetry && (
            <button type="button" onClick={onRetry} disabled={checking}>
              Try account again
            </button>
          )}
        </div>
      )}
      {detailsContent}
    </div>
  );
  return (
    <section
      className={`account-controls${toolbar ? ' account-toolbar' : ''}`}
      aria-labelledby={`${id}-heading`}
    >
      {needsAttention ? (
        <>
          {summary}
          {content}
        </>
      ) : (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape augments this native disclosure and returns focus to its interactive summary.
        <details
          className="account-options"
          open={expanded || checking || signingIn}
          onKeyDown={
            toolbar
              ? (event) => {
                  if (event.key !== 'Escape' || !event.currentTarget.open)
                    return;
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector('summary')?.focus();
                }
              : undefined
          }
          onBlur={
            toolbar
              ? (event) => {
                  const destination = event.relatedTarget;
                  if (
                    destination instanceof Node &&
                    event.currentTarget.contains(destination)
                  )
                    return;
                  event.currentTarget.open = false;
                }
              : undefined
          }
        >
          <summary
            aria-label={
              toolbar
                ? `${phase === 'owner' ? identity || 'Account' : 'Account'}: ${signingIn ? 'Signing in…; ' : ''}${phase === 'owner' ? labels[status] : 'Sign in to save your learning'}`
                : undefined
            }
          >
            {summary}
          </summary>
          {content}
        </details>
      )}
    </section>
  );
}
