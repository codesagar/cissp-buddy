import '../scripts/qa-tsx-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const { AccountControls } = await import('../components/account-controls.tsx');
const actions = { onRemember() {}, onSignIn() {}, onSignOut() {} };
const render = (props) =>
  renderToStaticMarkup(
    React.createElement(AccountControls, {
      phase: 'guest',
      configured: true,
      remember: false,
      status: 'local',
      pending: false,
      ...actions,
      ...props,
    }),
  );
test('unconfigured study does not advertise available cloud sign-in or claim account persistence', () => {
  const html = render({ configured: false });
  assert.match(html, /Cloud saving is not configured/);
  assert.doesNotMatch(html, /Sign in with Google|Saved to your account/);
});
test('an unresolved save blocks sign-out and retains an export recovery action', () => {
  const html = render({
    phase: 'owner',
    identity: 'owner@example.test',
    status: 'saving',
    pending: true,
    onExport() {},
  });
  assert.match(html, /disabled="">Sign out/);
  assert.match(html, /Export current progress/);
  assert.match(html, /have not been confirmed/);
  assert.doesNotMatch(html, />Saved to your account</);
});
test('account restoration does not display a previous identity or a successful-save claim', () => {
  const html = render({
    phase: 'restoring',
    identity: 'previous@example.test',
    status: 'saved',
  });
  assert.match(html, /Restoring your identity/);
  assert.doesNotMatch(
    html,
    /previous@example.test|Saved to your account|Sign out/,
  );
});
test('another account receives an explicit denial rather than an adoption or private-history view', () => {
  const html = render({
    phase: 'unauthorized',
    identity: 'other@example.test',
    status: 'local',
  });
  assert.match(html, /not enabled for private learning records/);
  assert.match(html, /No account progress has been loaded or copied/);
  assert.doesNotMatch(html, /Saved to your account|Sign in with Google/);
});

test('pending sign-in prevents duplicate activation and a rejected attempt restores sign-in with an error', () => {
  const pending = render({ signingIn: true });
  assert.match(pending, /disabled="" aria-busy="true">Signing in…/);
  assert.match(pending, /Complete the Google sign-in window/);
  const rejected = render({
    signingIn: false,
    issue: 'The sign-in window was closed. Retry sign-in when ready.',
  });
  assert.match(rejected, /aria-busy="false">Sign in with Google/);
  assert.match(rejected, /The sign-in window was closed/);
  assert.doesNotMatch(rejected, /disabled="" aria-busy="false"/);
});

test('everyday account identity and save status remain visible in a native compact disclosure', () => {
  const html = render({
    phase: 'owner',
    identity: 'owner@example.test',
    status: 'saved',
    remember: true,
    onExport() {},
    detailsContent: React.createElement(
      'p',
      null,
      'Personal-device recovery information',
    ),
  });
  assert.match(html, /<details class="account-options">/);
  const summary = html.match(/<summary>(.*?)<\/summary>/s)?.[1];
  assert.ok(summary);
  assert.match(summary, /Your learning account/);
  assert.match(summary, /owner@example.test/);
  assert.match(summary, /Saved to your account/);
  assert.match(summary, /Account options/);
  assert.match(summary, /Device recovery copies remain after sign-out/);
  assert.doesNotMatch(summary, /<button|Personal-device/);
  assert.match(html, /<\/summary>.*Export current progress.*Personal-device/s);
});

test('guest sign-in remains available through a native disclosure and backup context opens it', () => {
  const compact = render();
  assert.match(compact, /<details class="account-options">/);
  assert.match(compact, /Sign-in &amp; backups/);
  assert.match(compact, /<\/summary>.*Remember me.*Sign in with Google/s);
  assert.match(
    render({ expanded: true }),
    /<details class="account-options" open="">/,
  );
});

test('offline and error states expose recovery without a collapsed disclosure', () => {
  for (const status of ['offline', 'error']) {
    const html = render({
      phase: 'owner',
      status,
      pending: true,
      onExport() {},
    });
    assert.doesNotMatch(html, /<details|<summary/);
    assert.match(html, /disabled="">Sign out/);
    assert.match(html, /Export current progress/);
    assert.match(html, /have not been confirmed/);
  }
  const issue = render({ issue: 'A sign-in error needs attention.' });
  assert.doesNotMatch(issue, /<details|<summary/);
  assert.match(issue, /role="alert">A sign-in error needs attention/);
});

test('setup and required recovery remain expanded; ordinary saving keeps its compact status', () => {
  const setup = render({ phase: 'setup', accountId: 'owner-test' });
  assert.doesNotMatch(setup, /<details|<summary/);
  assert.match(setup, /Your setup account ID/);
  const recovery = render({ phase: 'owner', attention: true });
  assert.doesNotMatch(recovery, /<details|<summary/);
  const saving = render({ phase: 'owner', status: 'saving', pending: true });
  assert.match(saving, /<details class="account-options">/);
  assert.match(
    saving.match(/<summary>(.*?)<\/summary>/s)?.[1] || '',
    /Saving to your account/,
  );
});
