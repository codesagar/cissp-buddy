import type { TeachingModel } from './types.ts';
export function wrapDiagramLabel(text: string, max = 24) {
  const result = [''];
  for (const word of text.split(/\s+/)) {
    const i = result.length - 1;
    if (`${result[i]} ${word}`.trim().length > max && result[i])
      result.push(word);
    else result[i] += (result[i] ? ' ' : '') + word;
  }
  return result;
}
export type Point = { x: number; y: number };
export function relationshipLayout(model: TeachingModel) {
  const laneMode =
    ['boundary', 'ledger'].includes(model.representation) &&
    !!model.lanes?.length;
  const lanes = laneMode ? model.lanes! : [];
  const width = Math.max(840, lanes.length * 280),
    nodeW = 220;
  const nodeH = Math.max(
    88,
    ...model.nodes.map((n) => wrapDiagramLabel(n.label, 25).length * 20 + 48),
  );
  const rowGap = nodeH + 92;
  const header = Math.max(
    110,
    ...lanes.map((l) => wrapDiagramLabel(l.label, 22).length * 19 + 40),
  );
  const positions = new Map<string, Point>();
  let height = Math.ceil(model.nodes.length / 3) * rowGap + 70;
  if (laneMode) {
    const colW = width / lanes.length;
    let maxRows = 0;
    lanes.forEach((lane, i) => {
      const nodes = model.nodes.filter((n) => n.lane === lane.id);
      maxRows = Math.max(maxRows, nodes.length);
      nodes.forEach((n, j) =>
        positions.set(n.id, {
          x: colW * i + (colW - nodeW) / 2,
          y: header + j * rowGap,
        }),
      );
    });
    height = header + maxRows * rowGap + 50;
  } else
    model.nodes.forEach((n, i) =>
      positions.set(n.id, {
        x: 30 + (i % 3) * 280,
        y: 40 + Math.floor(i / 3) * rowGap,
      }),
    );
  // Validation rejects unassigned boundary nodes; keep them inspectable in error recovery.
  model.nodes
    .filter((n) => !positions.has(n.id))
    .forEach((n) => {
      positions.set(n.id, { x: 30, y: height });
      height += rowGap;
    });
  return { width, height, nodeW, nodeH, positions, laneMode, lanes, rowGap };
}
export function relationshipRoute(
  model: TeachingModel,
  index: number,
  layout = relationshipLayout(model),
) {
  const edge = model.edges[index],
    { positions, nodeW, nodeH, height, laneMode, rowGap } = layout;
  const from = edge && positions.get(edge.from),
    to = edge && positions.get(edge.to);
  if (!from || !to) return { path: '', points: [] as Point[] };
  const gap = edge.kind === 'blocked' ? 28 : 4;
  let points: Point[];
  if (from.x === to.x) {
    const left = from.x + nodeW + 50 > layout.width;
    const rail = from.x + (left ? -50 : nodeW + 50);
    points = [
      { x: from.x + (left ? 0 : nodeW), y: from.y + nodeH / 2 },
      { x: rail, y: from.y + nodeH / 2 },
      { x: rail, y: to.y + nodeH / 2 },
      { x: to.x + (left ? -gap : nodeW + gap), y: to.y + nodeH / 2 },
    ];
  } else if (from.y === to.y) {
    const rail = from.y + nodeH + 36;
    points = [
      { x: from.x + nodeW / 2, y: from.y + nodeH },
      { x: from.x + nodeW / 2, y: rail },
      { x: to.x + nodeW / 2, y: rail },
      { x: to.x + nodeW / 2, y: to.y + nodeH + gap },
    ];
  } else if (!laneMode && Math.abs(from.y - to.y) <= rowGap) {
    const rail = (Math.min(from.y, to.y) + nodeH + Math.max(from.y, to.y)) / 2,
      down = to.y > from.y;
    points = [
      { x: from.x + nodeW / 2, y: from.y + (down ? nodeH : 0) },
      { x: from.x + nodeW / 2, y: rail },
      { x: to.x + nodeW / 2, y: rail },
      { x: to.x + nodeW / 2, y: to.y + (down ? -gap : nodeH + gap) },
    ];
  } else {
    const right = to.x > from.x,
      sx = from.x + (right ? nodeW : 0),
      tx = to.x + (right ? 0 : nodeW);
    points = [
      { x: sx, y: from.y + nodeH / 2 },
      { x: sx + (right ? 50 : -50), y: from.y + nodeH / 2 },
      { x: sx + (right ? 50 : -50), y: height - 26 },
      { x: tx + (right ? -50 : 50), y: height - 26 },
      { x: tx + (right ? -50 : 50), y: to.y + nodeH / 2 },
      { x: tx + (right ? -gap : gap), y: to.y + nodeH / 2 },
    ];
  }
  return {
    points,
    path: points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' '),
  };
}
