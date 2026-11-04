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
