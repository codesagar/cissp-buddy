import '../scripts/qa-tsx-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const { CourseFigure } = await import('../components/course-figure.tsx');
const unit = JSON.parse(
  readFileSync(
    new URL(
      '../lib/data/course/units/d1-o01-professional-ethics.json',
      import.meta.url,
    ),
  ),
);
const model = unit.teaching;
const placeholder =
  'Relevant actor, boundary, evidence source, or alternative; its outcome remains unresolved at prediction time.';
const render = (override = {}) =>
  renderToStaticMarkup(
    React.createElement(CourseFigure, {
      model: { ...model, ...override },
      state: model.states[0],
      complete: false,
      beforePrediction: true,
    }),
  );

test('checkpoint facts retain concrete amounts, conditions and authority above the disclosure', () => {
  const html = render({
    openingFacts: [
      {
        label: 'Recovery target',
        value:
          'Restore service within 4 hours; retain at most 15 minutes of lost data.',
      },
      {
        label: 'Approval',
        value: 'Only the designated risk owner can accept the residual risk.',
      },
      { label: 'Actor', value: placeholder },
      { label: 'Boundary', value: placeholder },
    ],
  });
  const [visible, disclosure] = html.split('<details');
  assert.ok(visible.includes('within 4 hours'));
  assert.ok(visible.includes('15 minutes'));
  assert.ok(visible.includes('Only the designated risk owner'));
  assert.ok(!visible.includes(placeholder));
  assert.equal(html.split(placeholder).length - 1, 1);
  assert.ok(disclosure.includes('<li>Actor</li>'));
  assert.ok(disclosure.includes('<li>Boundary</li>'));
  assert.match(html, /<h3>Case facts<\/h3>/);
  assert.ok(html.includes(`${model.title}: case facts`));
  assert.doesNotMatch(html, /Case facts · outcome not revealed/);
  for (const node of model.nodes.filter((node) =>
    model.states[0].activeNodeIds.includes(node.id),
  ))
    assert.ok(disclosure.includes(node.label));
});

test('only the exact known placeholder is collapsed', () => {
  const meaningful = `${placeholder} The owner has not yet approved the exception.`;
  const visible = render({
    openingFacts: [{ label: 'Authority condition', value: meaningful }],
  }).split('<details')[0];
  assert.ok(visible.includes(meaningful));
});

test('all-placeholder facts retain every label and one full original explanation in the text alternative', () => {
  const html = render({
    openingFacts: [
      { label: 'First unresolved actor', value: placeholder },
      { label: 'Second unresolved boundary', value: placeholder },
    ],
  });
  const [visible, disclosure] = html.split('<details');
  assert.ok(!visible.includes('opening-fact-grid'));
  assert.ok(disclosure.includes('Read the case facts as text'));
  assert.ok(disclosure.includes('First unresolved actor'));
  assert.ok(disclosure.includes('Second unresolved boundary'));
  assert.equal(disclosure.split(placeholder).length - 1, 1);
});

test('authored checkpoint opening facts remain intact except the exact generic placeholder', () => {
  const [visible, disclosure] = render().split('<details');
  for (const fact of model.openingFacts) {
    if (fact.value === placeholder) assert.ok(disclosure.includes(fact.label));
    else {
      assert.ok(visible.includes(fact.label));
      assert.ok(visible.includes(fact.value.replaceAll('&', '&amp;')));
    }
  }
});
