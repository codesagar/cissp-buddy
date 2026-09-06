import type { ConceptNode } from './curriculum';
export function ancestors(nodes: ConceptNode[], id: string): string[] {
  const lookup = new Map(nodes.map((n) => [n.id, n]));
  const path: string[] = [];
  const seen = new Set<string>();
  let current = lookup.get(id);
  while (current) {
    if (seen.has(current.id)) throw new Error('Cycle in concept hierarchy');
    seen.add(current.id);
    path.unshift(current.id);
    current = current.parentId ? lookup.get(current.parentId) : undefined;
  }
  return path;
}
export function descendants(nodes: ConceptNode[], id: string): ConceptNode[] {
  const result: ConceptNode[] = [];
  const seen = new Set([id]);
  const queue = [id];
  while (queue.length) {
    const parent = queue.shift();
    for (const n of nodes.filter((n) => n.parentId === parent)) {
      if (seen.has(n.id)) throw new Error('Cycle in concept hierarchy');
      seen.add(n.id);
      result.push(n);
      queue.push(n.id);
    }
  }
  return result;
}
export function visibleBranch(
  nodes: ConceptNode[],
  rootId: string,
  expanded: Set<string>,
): ConceptNode[] {
  return nodes.filter(
    (n) =>
      n.rootConceptId === rootId &&
      ancestors(nodes, n.id)
        .slice(0, -1)
        .every((id) => expanded.has(id)),
  );
}
export function branchLayout(
  nodes: ConceptNode[],
  rootId: string,
): Map<string, { x: number; y: number; depth: number }> {
  const result = new Map<string, { x: number; y: number; depth: number }>();
  let leaf = 0;
  const walk = (id: string, depth: number): number => {
    const children = nodes
      .filter((n) => n.parentId === id)
      .sort((a, b) => a.order - b.order);
    let y: number;
    if (!children.length) y = 80 + leaf++ * 160;
    else {
      const rows = children.map((c) => walk(c.id, depth + 1));
      y = (rows[0] + rows[rows.length - 1]) / 2;
    }
    result.set(id, { x: 80 + depth * 290, y, depth });
    return y;
  };
  walk(rootId, 0);
  return result;
}
export function revealPath(
  nodes: ConceptNode[],
  id: string,
  expanded: Set<string>,
): Set<string> {
  return new Set([...expanded, ...ancestors(nodes, id)]);
}
export function hiddenRelationships(
  nodes: ConceptNode[],
  id: string,
  visible: Set<string>,
  edges: { from: string; to: string; label: string }[] = [],
) {
  const scope = [
    nodes.find((n) => n.id === id),
    ...descendants(nodes, id),
  ].filter((n): n is ConceptNode => !!n);
  const seen = new Set<string>();
  const scopeIds = new Set(scope.map((n) => n.id));
  return [
    ...scope.flatMap((n) => n.relatedIds.map((to) => ({ from: n.id, to }))),
    ...edges.filter((e) => scopeIds.has(e.from) || scopeIds.has(e.to)),
  ].filter((e) => {
    const key = [e.from, e.to].sort().join('|');
    if (seen.has(key) || (visible.has(e.from) && visible.has(e.to)))
      return false;
    seen.add(key);
    return true;
  });
}
