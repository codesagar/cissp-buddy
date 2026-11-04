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
  assert.match(html, /Google sign-in is currently unavailable/);
  assert.doesNotMatch(html, /Sign in with Google|Saved to your account/);
});
test('an unresolved save blocks sign-out and offers retry without a backup route', () => {
  const html = render({
    phase: 'owner',
    identity: 'owner@example.test',
    status: 'saving',
    pending: true,
  });
  assert.match(html, /disabled="">Sign out/);
  assert.match(html, /keep this page open and retry account saving/i);
  assert.doesNotMatch(html, /Export current progress|backup/);
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
  assert.doesNotMatch(summary, /<button|Personal-device/);
  assert.match(html, /<\/summary>.*Personal-device/s);
});

test('guest sign-in is immediately visible without offering local saving', () => {
  for (const variant of ['panel', 'toolbar']) {
    const html = render({ variant });
    assert.doesNotMatch(html, /<details|<summary|Study locally|Saved in this browser/);
    assert.match(html, /Sign in with Google/);
    assert.match(html, /save and resume your learning across devices/);
  }
});

test('offline and error states expose recovery without a collapsed disclosure', () => {
  for (const status of ['offline', 'error']) {
    const html = render({
      phase: 'owner',
      status,
      pending: true,
      });
    assert.doesNotMatch(html, /<details|<summary/);
    assert.match(html, /disabled="">Sign out/);
    assert.match(html, /keep this page open and retry account saving/i);
  assert.doesNotMatch(html, /Export current progress|backup/);
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

test('healthy toolbar exposes identity/save once and operations inside disclosure', () => {
  const html = render({
    variant: 'toolbar',
    phase: 'owner',
    identity: 'owner@example.test',
    status: 'saved',
    remember: true,
  });
  const summary = html.match(/<summary[^>]*>(.*?)<\/summary>/s)?.[1] || '';
  assert.match(summary, /owner@example.test/);
  assert.match(summary, /Saved to your account/);
  assert.doesNotMatch(
    summary,
    /Your learning account|Account options|Device recovery/,
  );
  assert.equal((html.match(/>Saved to your account</g) || []).length, 1);
  assert.match(html, /aria-label="owner@example.test: Saved to your account"/);
  assert.match(
    html,
    /<\/summary>.*Sign out/s,
  );

});

test('toolbar attention/restoration show full panel while settings can stay expanded', () => {
  for (const props of [
    { status: 'offline' },
    { status: 'error' },
    { phase: 'setup' },
    { phase: 'unauthorized' },
    { phase: 'restoring' },
    { attention: true },
  ]) {
    assert.doesNotMatch(
      render({ variant: 'toolbar', phase: 'owner', ...props }),
      /<details|<summary/,
    );
  }
  assert.match(
    render({ phase: 'owner', expanded: true }),
    /<details class="account-options" open="">/,
  );
});

test('mobile toolbar surfaces pending work without adding another status badge', () => {
  const saving = render({
    variant: 'toolbar',
    phase: 'owner',
    identity: 'owner@example.test',
    status: 'saving',
    pending: true,
  });
  assert.match(saving, /class="account-toolbar-title-mobile">Saving…<\/span>/);
  assert.match(
    saving,
    /aria-label="owner@example.test: Saving to your account…"/,
  );
  const signingIn = render({ variant: 'toolbar', signingIn: true });
  assert.match(signingIn, /disabled="" aria-busy="true">Signing in…/);
});
