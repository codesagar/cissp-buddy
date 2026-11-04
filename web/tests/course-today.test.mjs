import '../scripts/qa-tsx-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  emptyLearnerState,
  newPosition,
  recommendCourseUnit,
} from '../lib/course/learner-state.ts';
const { CourseToday } = await import('../components/course-today.tsx');
const json = (path) =>
  JSON.parse(
    readFileSync(new URL(`../lib/data/course/${path}`, import.meta.url)),
  );
const manifest = json('manifest.json');
const render = (state, props = {}) =>
  renderToStaticMarkup(
    React.createElement(CourseToday, { manifest, state, now: 1000, ...props }),
  );
const primaryCount = (html) =>
  (html.match(/class="course-primary"/g) || []).length;

test('new learner sees the recommended real unit and one primary action', () => {
  const state = emptyLearnerState();
  const recommendation = recommendCourseUnit(state, manifest);
  const html = render(state);
  assert.match(html, /<h1>Today<\/h1>/);
  assert.ok(html.includes(recommendation.unit.title));
  assert.ok(
    html.includes(recommendation.unit.outcome.replaceAll('&', '&amp;')),
  );
  assert.ok(html.includes(recommendation.reason));
  assert.equal(primaryCount(html), 1);
  assert.doesNotMatch(
    html,
    /journey-preview|domain-overview|Units visited|Next unanswered unit/,
  );
});

test('saved canonical unit remains the primary resume destination', () => {
  const state = emptyLearnerState();
  const unit = manifest.units[3];
  state.lastUnitId = unit.id;
  state.units[unit.id] = newPosition(100);
  const html = render(state);
  assert.ok(html.includes(`class="course-primary" href="#/unit/${unit.id}"`));
  assert.match(html, /Resume learning/);
  assert.equal(primaryCount(html), 1);
  assert.match(html, /Next unanswered unit/);
});

test('same recommended and resumed unit does not duplicate the next action', () => {
  const state = emptyLearnerState();
  state.lastUnitId = recommendCourseUnit(state, manifest).unit.id;
  const html = render(state);
  assert.equal(primaryCount(html), 1);
  assert.doesNotMatch(html, /Next unanswered unit/);
});

test('unseen cross-domain resume shows neutral context without revealing the answer or changing assistance', () => {
  const index = json('connections-index.json');
  const connection = json(`connections/${index.cases[0].id}.json`);
  const state = emptyLearnerState();
  state.lastUnitId = connection.id;
  state.units[connection.id] = newPosition(100);
  const before = structuredClone(state);
  const html = render(state, { connection });
  assert.ok(html.includes(connection.title));
  assert.ok(html.includes(connection.model.scenario.replaceAll('&', '&amp;')));
  assert.ok(!html.includes(connection.model.takeaway.replaceAll('&', '&amp;')));
  assert.ok(
    !html.includes(connection.model.focalRelation.replaceAll('&', '&amp;')),
  );
  assert.deepEqual(state, before);
  assert.equal(state.units[connection.id].step, 0);
  assert.ok(!state.units[connection.id].exploration?.workedOutcomeVisible);
  assert.deepEqual(state.units[connection.id].checks, {});
  assert.ok(
    html.includes(`class="course-primary" href="#/unit/${connection.id}"`),
  );
  assert.equal(primaryCount(html), 1);
});

test('pending or failed cross-domain resume does not start a different unit', () => {
  const state = emptyLearnerState();
  state.lastUnitId = 'cross-governance-risk--reopen-risk';
  assert.match(render(state), /Opening your saved cross-domain case/);
  assert.equal(primaryCount(render(state)), 0);
  const html = render(state, { connectionError: 'Unavailable.' });
  assert.match(html, /Try loading your case again/);
  assert.match(html, /Your saved place is unchanged/);
  assert.ok(html.includes(`href="#/unit/${state.lastUnitId}"`));
  assert.equal(primaryCount(html), 1);
});
