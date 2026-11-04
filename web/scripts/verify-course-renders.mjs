import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { CourseFigure } from '../components/course-figure.tsx';
import { repairPosition } from '../lib/course/learner-state.ts';
const rows = [];
let renders = 0,
  repairs = 0,
  factualRenders = 0;
const warnings = [];
const originalError = console.error;
console.error = (...args) => warnings.push(args.join(' '));
const escape = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
for (const dir of ['teaching', 'connections'])
  for (const file of readdirSync(
    new URL(`../lib/data/${dir}/`, import.meta.url),
  ).filter(
    (f) =>
      f.endsWith('.json') &&
      !['index.json', 'reference-relationships.json'].includes(f),
  )) {
    const bytes = readFileSync(
        new URL(`../lib/data/${dir}/${file}`, import.meta.url),
        'utf8',
      ),
      model = JSON.parse(bytes);
    const cases = [
      { id: 'base', states: model.states },
      ...(model.variants || []),
    ];
    for (const c of cases) {
      const effective = {
        ...model,
        nodes: c.nodes || model.nodes,
        edges: c.edges || model.edges,
        lanes: c.lanes || model.lanes,
        quantitative: c.quantitative || model.quantitative,
      };
      for (const state of c.states) {
        const html = renderToStaticMarkup(
          React.createElement(CourseFigure, {
            model: effective,
            state,
            complete: false,
          }),
        );
        assert.ok(
          html.includes('<figure'),
          `${model.unitId}/${c.id}/${state.id} figure`,
        );
        assert.ok(
          !/="(?:NaN|undefined|Infinity)"/.test(html),
          `${model.unitId}/${state.id} finite attributes`,
        );
        for (const node of effective.nodes)
          assert.ok(
            html.includes(escape(node.label)),
            `${model.unitId}/${c.id}/${state.id} includes node ${node.id} in graphic or complete text equivalent`,
          );
        for (const edge of effective.edges)
          assert.ok(
            html.includes(escape(edge.label)),
            `${model.unitId}/${c.id}/${state.id} labels every relation`,
          );
        if (!['comparison'].includes(effective.representation))
          assert.ok(
            html.includes('<svg'),
            `${model.unitId}/${state.id} renders actual diagram`,
          );
        const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
        assert.equal(
          ids.length,
          new Set(ids).size,
          `${model.unitId}/${state.id} no duplicate element IDs`,
        );
        renders++;
        const facts = renderToStaticMarkup(
          React.createElement(CourseFigure, {
            model: effective,
            state,
            complete: false,
            beforePrediction: true,
          }),
        );
        for (const edge of effective.edges)
          assert.ok(
            !facts.includes(escape(edge.label)),
            `${model.unitId}/${c.id}/${state.id} does not reveal reasoning edges before prediction`,
          );
        assert.ok(
          !facts.includes('outside-target'),
          `${model.unitId}/${state.id} no quantitative verdict colors before prediction`,
        );
        assert.ok(
          !facts.includes('within RTO and maximum disruption'),
          `${model.unitId}/${state.id} no quantitative verdict before prediction`,
        );
        factualRenders++;
      }
    }
    for (const phase of ['prediction', 'transfer', 'retry'])
      for (const option of model[phase].options) {
        const p = repairPosition(model, option.repairStateId);
        const states =
          p.variant === 'base'
            ? model.states
            : model.variants.find((v) => v.id === p.variant).states;
        assert.equal(
          states[p.step].id,
          option.repairStateId,
          `${model.unitId}/${phase}/${option.id} exact repair`,
        );
        repairs++;
      }
    rows.push({
      unitId: model.unitId,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      cases: cases.length,
      states: cases.reduce((n, c) => n + c.states.length, 0),
    });
  }
console.error = originalError;
assert.deepEqual(warnings, [], 'React rendering emits no warnings');
const result = {
  checkedAt: new Date().toISOString(),
  kind: 'Exhaustive production React static rendering, not browser screenshots or learning-effectiveness evidence',
  models: rows.length,
  renders,
  factualRenders,
  repairOptions: repairs,
  status: 'pass',
  rows,
};
const webRoot = fileURLToPath(new URL('../', import.meta.url));
const requestedOutput = process.argv.find((argument) => argument.startsWith('--output='))?.slice('--output='.length);
const outputPath = requestedOutput
  ? path.resolve(process.cwd(), requestedOutput)
  : path.join(webRoot, 'outputs/static-qa/all-state-react-render-check.json');
const historicalRoots = ['visual-learning-production', 'visual-explanation-implementation'].map((name) => path.resolve(webRoot, '../planning', name));
if (historicalRoots.some((root) => outputPath === root || outputPath.startsWith(root + path.sep)))
  throw new Error('Historical acceptance reports are protected; choose a new output path.');
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(
  JSON.stringify({
    models: rows.length,
    renders,
    factualRenders,
    repairOptions: repairs,
    status: 'pass',
  }),
);
