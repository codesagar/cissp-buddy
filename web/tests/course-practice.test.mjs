import '../scripts/qa-tsx-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  emptyLearnerState,
  newPosition,
  validateLearnerState,
} from '../lib/course/learner-state.ts';

const { CoursePractice } = await import('../components/course-practice.tsx');
const readJson = (file) =>
  JSON.parse(
    readFileSync(new URL(`../lib/data/course/${file}`, import.meta.url)),
  );
const sourceManifest = readJson('manifest.json');
const connectionIndex = readJson('connections-index.json');
const units = sourceManifest.units
  .filter((unit) => unit.domainId === 1)
  .slice(0, 2);
const manifest = {
  ...sourceManifest,
  domains: sourceManifest.domains.filter((domain) => domain.id === 1),
  units,
};
const now = 100000;
const review = (dueAt) => ({
  dueAt,
  lastAt: 0,
  intervalDays: 1,
  needsReview: false,
});
const render = (state, override = manifest, children) =>
  renderToStaticMarkup(
    React.createElement(
      CoursePractice,
      { manifest: override, state, now },
      children,
    ),
  );

function answerPrediction(state, unit, questionId = unit.checks[0].id) {
  const snapshot = readJson(`units/${unit.id}.json`).teaching.prediction;
  const attempt = {
    id: `attempt-${unit.id}`,
    unitId: unit.id,
    questionId,
    kind: 'prediction',
    selected: snapshot.options.find((option) => option.correct).id,
    correct: true,
    guess: false,
    hintUsed: false,
    at: 10,
    releaseId: manifest.releaseId,
    conceptIds: snapshot.conceptIds,
    snapshot: { ...snapshot, id: questionId },
  };
  state.attempts.push(attempt);
  state.units[unit.id] = {
    ...newPosition(10),
    checks: {
      [questionId]: {
        selected: attempt.selected,
        guess: false,
        hintUsed: false,
        submittedAttemptId: attempt.id,
      },
    },
  };
}

test('review rows preserve overdue order across units and current connection cases, excluding retired IDs', () => {
  const state = emptyLearnerState();
  const connection = connectionIndex.cases[0];
  state.reviews = {
    [units[0].id]: review(30),
    [connection.id]: review(20),
    [units[1].id]: review(10),
    'retired-unit': review(1),
    'cross-retired--case': review(2),
  };
  const html = render(state);
  const reviewLinks = [
    ...html.matchAll(/class="review-queue-row" href="([^"]+)"/g),
  ].map((match) => match[1]);
  assert.deepEqual(reviewLinks, [
    `#/unit/${units[1].id}/review`,
    `#/unit/${connection.id}/review`,
    `#/unit/${units[0].id}/review`,
  ]);
  assert.match(html, new RegExp(connection.title));
  assert.doesNotMatch(html, /retired-unit|cross-retired--case/);
});

test('connection metadata from another release or source is never substituted into the review queue', () => {
  const state = emptyLearnerState();
  const connection = connectionIndex.cases[0];
  state.reviews[connection.id] = review(1);
  for (const override of [
    { ...manifest, releaseId: 'older-release' },
    { ...manifest, sourceHash: 'another-source' },
  ]) {
    const html = render(state, override);
    assert.doesNotMatch(html, /class="review-queue-row"/);
    assert.doesNotMatch(html, new RegExp(connection.title));
  }
  assert.ok(
    state.reviews[connection.id],
    'historical record remains untouched',
  );
});

test('an exhausted domain offers saved evidence rather than an already submitted fresh prediction', () => {
  const state = emptyLearnerState();
  units.forEach((unit) => answerPrediction(state, unit));
  const html = render(state);
  assert.match(html, new RegExp(`href="#/unit/${units[0].id}/review"`));
  assert.match(html, /Revisit saved evidence/);
  assert.doesNotMatch(html, /\/predict"|Choose a fresh prediction/);
});

test('historical prediction identities and another unit cannot conceal an unanswered current prediction', () => {
  const state = emptyLearnerState();
  answerPrediction(state, units[0], 'retired-prediction-v1');
  answerPrediction(state, units[1]);
  state.attempts.push({
    ...state.attempts[1],
    id: 'wrong-unit-reference',
    questionId: units[0].checks[0].id,
  });
  const html = render(state);
  assert.match(html, new RegExp(`href="#/unit/${units[0].id}/predict"`));
  assert.match(html, /Try an unanswered prediction/);
});

test('valid historical backups with incompatible kind or concept scope do not hide an unanswered current prediction', () => {
  const alterHistory = [
    (attempt) => {
      attempt.kind = 'transfer';
    },
    (attempt) => {
      attempt.conceptIds = ['historical-scope'];
      attempt.snapshot.conceptIds = ['historical-scope'];
    },
  ];
  for (const alter of alterHistory) {
    const state = emptyLearnerState();
    units.forEach((unit) => answerPrediction(state, unit));
    alter(state.attempts[0]);
    const restored = validateLearnerState(JSON.parse(JSON.stringify(state)));
    const html = render(restored);
    assert.match(html, new RegExp(`href="#/unit/${units[0].id}/predict"`));
    assert.match(html, /Try an unanswered prediction/);
    assert.doesNotMatch(html, /Revisit saved evidence/);

    assert.equal(
      restored.attempts.length,
      2,
      'historical attempts are retained',
    );
  }
});

test('compatible past-release answers to stable current checks remain answered', () => {
  const state = emptyLearnerState();
  units.forEach((unit) => answerPrediction(state, unit));
  state.attempts.forEach((attempt) => {
    attempt.releaseId = 'earlier-compatible-release';
    attempt.conceptIds = [...attempt.conceptIds].reverse();
    attempt.snapshot.conceptIds = [...attempt.snapshot.conceptIds].reverse();
  });
  const restored = validateLearnerState(JSON.parse(JSON.stringify(state)));
  const html = render(restored);
  assert.match(html, new RegExp(`href="#/unit/${units[0].id}/review"`));
  assert.match(html, /Revisit saved evidence/);
  assert.doesNotMatch(html, /\/predict"/);
  assert.equal(restored.attempts[0].releaseId, 'earlier-compatible-release');
});

test('empty review copy distinguishes scheduled reviews from a learner with no current review history', () => {
  const state = emptyLearnerState();
  const fresh = render(state);
  assert.match(fresh, /Your first answer will create a review record/);
  assert.equal((fresh.match(/<h2>/g) || []).length, 1);
  assert.match(fresh, /<h2>No reviews due\.<\/h2>/);
  assert.doesNotMatch(
    fresh,
    /Ready to revisit|units and cases|0 due|<h2>Reviews<\/h2>/,
  );
  state.reviews[units[0].id] = review(now + 10000);
  const scheduled = render(state);
  assert.match(scheduled, /Your saved reviews are scheduled for later/);
  assert.doesNotMatch(
    scheduled,
    /first answer will create|next answer will create/,
  );
});

test('the current evidence slot appears after the review queue and before domain practice', () => {
  const state = emptyLearnerState();
  state.reviews[units[0].id] = review(1);
  const html = render(
    state,
    manifest,
    React.createElement('section', null, 'Current evidence slot'),
  );
  assert.ok(
    html.indexOf('review-queue-row') < html.indexOf('Current evidence slot'),
  );
  assert.ok(
    html.indexOf('Current evidence slot') <
      html.indexOf('Practice across domains'),
  );
  assert.match(
    html,
    /<details class="practice-domains"><summary>Practice across domains/,
  );
  assert.doesNotMatch(
    html,
    /Earlier activity and assessment scope|learning-evidence-actions/,
  );
});

test('long queues preserve due-date order with five reviews initially visible', () => {
  const state = emptyLearnerState();
  const selected = sourceManifest.units.slice(0, 8);
  selected.forEach((unit, index) => {
    state.reviews[unit.id] = review(80 - index);
  });
  const html = render(state, sourceManifest);
  const links = [
    ...html.matchAll(/class="review-queue-row" href="([^"]+)"/g),
  ].map((match) => match[1]);
  assert.deepEqual(
    links,
    [...selected].reverse().map((unit) => `#/unit/${unit.id}/review`),
  );
  assert.match(html, /<h2>Reviews<\/h2><span>8 due<\/span>/);
  const details = html.indexOf('<details class="practice-more-reviews">');
  assert.equal(
    [...html.slice(0, details).matchAll(/class="review-queue-row"/g)].length,
    5,
  );
  assert.match(html.slice(details), /<summary>More reviews \(3\)<\/summary>/);
});

test('no-due primary action follows the shared selector to an unanswered changed case', () => {
  const state = emptyLearnerState();
  units.forEach((unit) => answerPrediction(state, unit));
  const html = render(state);
  assert.match(
    html,
    new RegExp(`class="course-primary" href="#/unit/${units[0].id}/transfer"`),
  );
  assert.match(html, />Try the changed case</);
});
