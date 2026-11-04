import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import {
  relationshipLayout,
  relationshipRoute,
  wrapDiagramLabel,
} from '../lib/course/diagram-layout.ts';
const authored = ['teaching', 'connections'].flatMap((dir) =>
  readdirSync(new URL(`../lib/data/${dir}/`, import.meta.url))
    .filter(
      (f) =>
        f.endsWith('.json') &&
        !['index.json', 'reference-relationships.json'].includes(f),
    )
    .map((f) =>
      JSON.parse(
        readFileSync(
          new URL(`../lib/data/${dir}/${f}`, import.meta.url),
          'utf8',
        ),
      ),
    ),
);
const models = authored.flatMap((m) => [
  m,
  ...(m.variants || []).map((v) => ({
    ...m,
    unitId: `${m.unitId}/${v.id}`,
    nodes: v.nodes || m.nodes,
    edges: v.edges || m.edges,
    lanes: v.lanes || m.lanes,
  })),
]);
function crosses(a, b, r, w, h) {
  const left = r.x + 0.01,
    right = r.x + w - 0.01,
    top = r.y + 0.01,
    bottom = r.y + h - 0.01;
  return a.x === b.x
    ? a.x > left &&
        a.x < right &&
        Math.max(a.y, b.y) > top &&
        Math.min(a.y, b.y) < bottom
    : a.y > top &&
        a.y < bottom &&
        Math.max(a.x, b.x) > left &&
        Math.min(a.x, b.x) < right;
}
test('all authored map entities and labels fit their declared canvas', () => {
  for (const m of models) {
    const l = relationshipLayout(m);
    for (const n of m.nodes) {
      const p = l.positions.get(n.id);
      assert.ok(p, `${m.unitId}/${n.id} has position`);
      assert.ok(
        p.x >= 0 &&
          p.y >= 0 &&
          p.x + l.nodeW <= l.width &&
          p.y + l.nodeH <= l.height,
        `${m.unitId}/${n.id} within canvas`,
      );
      assert.ok(
        32 + (wrapDiagramLabel(n.label, 25).length - 1) * 20 < l.nodeH - 20,
        `${m.unitId}/${n.id} label separates from endpoint caption`,
      );
    }
  }
});
test('all authored relation routes avoid unrelated entities and keep stop points outside targets', () => {
  for (const m of models) {
    const l = relationshipLayout(m);
    for (let i = 0; i < m.edges.length; i++) {
      const e = m.edges[i],
        r = relationshipRoute(m, i, l);
      assert.ok(r.points.length >= 2);
      for (const p of r.points)
        assert.ok(
          p.x >= 0 && p.x <= l.width && p.y >= 0 && p.y <= l.height,
          `${m.unitId} edge${i} point ${JSON.stringify(p)} in canvas`,
        );
      for (const n of m.nodes) {
        if (n.id === e.from || n.id === e.to) continue;
        const p = l.positions.get(n.id);
        for (let j = 1; j < r.points.length; j++)
          assert.ok(
            !crosses(r.points[j - 1], r.points[j], p, l.nodeW, l.nodeH),
            `${m.unitId} edge${i} crosses unrelated ${n.id}`,
          );
      }
      if (e.kind === 'blocked') {
        const p = l.positions.get(e.to),
          end = r.points.at(-1);
        assert.ok(
          end.x <= p.x - 20 ||
            end.x >= p.x + l.nodeW + 20 ||
            end.y <= p.y - 20 ||
            end.y >= p.y + l.nodeH + 20,
          `${m.unitId} edge${i} blocked before target`,
        );
      }
    }
  }
});
