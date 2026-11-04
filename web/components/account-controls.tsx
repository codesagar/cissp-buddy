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
  configured: boolean;
  identity?: string;
  accountId?: string;
  remember: boolean;
  status: AccountSaveStatus;
  issue?: string;
  pending: boolean;
  signingIn?: boolean;
  /** Keep recovery or initial setup fully visible instead of collapsing it. */
  attention?: boolean;
  expanded?: boolean;
  detailsContent?: ReactNode;
  onRemember: (value: boolean) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onRetry?: () => void;
  onExport?: () => void;
  onCopyAccountId?: () => void;
};
const labels: Record<AccountSaveStatus, string> = {
  local: 'Saved in this browser',
  loading: 'Restoring account progress…',
  saving: 'Saving to your account…',
  saved: 'Saved to your account',
  offline: 'Offline — account save is pending',
  error: 'Account save needs attention',
};
export function AccountControls({
  phase,
  configured,
  identity,
  accountId,
  remember,
  status,
  issue,
  pending,
  signingIn = false,
  attention = false,
  expanded = false,
  detailsContent,
  onRemember,
  onSignIn,
  onSignOut,
  onRetry,
  onExport,
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
    !!issue ||
    phase === 'unauthorized' ||
    phase === 'setup' ||
    status === 'offline' ||
    status === 'error';
  const summary = (
    <h2 className="account-summary-content">
      <span id={`${id}-heading`} className="account-summary-title">
        {title}
      </span>
      {signedIn && identity && (
        <span className="account-identity">{identity}</span>
      )}
      {checking && <output>Restoring your identity and saved progress…</output>}
      {phase === 'guest' && (
        <span className="account-save-status">Learning in this browser</span>
      )}
      {phase === 'owner' && (
        <output className="account-save-status">{labels[status]}</output>
      )}
      {phase === 'owner' && remember && (
        <span className="account-device-summary">
          Device recovery copies remain after sign-out.
        </span>
      )}
      {!needsAttention && (
        <span className="account-disclosure-label">
          {phase === 'guest' ? 'Sign-in & backups' : 'Account options'}
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
                ? 'Study locally, or sign in to restore your learning across devices.'
                : 'Cloud saving is not configured yet. You can keep learning and export a local backup.'}
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
            <label>
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => onRemember(event.target.checked)}
              />
              Remember me on this personal device
            </label>
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
          this page open or export a backup. Sign-out is paused while saving is
          unresolved.
        </output>
      )}
      {issue && (
        <p className="account-issue" role="alert">
          {issue}
        </p>
      )}
      {(onExport || onRetry) && (
        <div className="account-recovery-actions">
          {onExport && (
            <button type="button" onClick={onExport}>
              Export current progress
            </button>
          )}
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
    <section className="account-controls" aria-labelledby={`${id}-heading`}>
      {needsAttention ? (
        <>
          {summary}
          {content}
        </>
      ) : (
        <details
          className="account-options"
          open={expanded || checking || signingIn}
        >
          <summary>{summary}</summary>
          {content}
        </details>
      )}
    </section>
  );
}
