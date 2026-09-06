import type { Curriculum } from '../curriculum';
export function validateRelease(pack: Curriculum) {
  const fail = (message: string): never => {
    throw new Error(`Content validation: ${message}`);
  };
  const unique = (ids: string[], label: string) => {
    if (new Set(ids).size !== ids.length) fail(`duplicate ${label} ID`);
  };
  unique(
    pack.nodes.map((n) => n.id),
    'concept',
  );
  unique(
    pack.lessons.map((l) => l.id),
    'lesson',
  );
  unique(
    pack.questions.map((q) => q.id),
    'question',
  );
  const nodes = new Map(pack.nodes.map((n) => [n.id, n])),
    lessons = new Map(pack.lessons.map((l) => [l.id, l]));
  if (!pack.releaseId || pack.storage !== 'D1')
    fail('release provenance missing');
  for (const n of pack.nodes) {
    if (
      !Number.isInteger(n.domainId) ||
      !pack.domains.some((d) => d.id === n.domainId)
    )
      fail(`invalid domain on ${n.id}`);
    if (!nodes.has(n.rootConceptId) || nodes.get(n.rootConceptId)!.parentId)
      fail(`invalid root on ${n.id}`);
    if (n.domainId !== nodes.get(n.rootConceptId)!.domainId)
      fail(`domain drift on ${n.id}`);
    if (n.parentId && !nodes.has(n.parentId)) fail(`missing parent on ${n.id}`);
    const seen = new Set([n.id]);
    let parent = n.parentId;
    while (parent) {
      if (seen.has(parent)) fail(`cycle at ${n.id}`);
      seen.add(parent);
      parent = nodes.get(parent)?.parentId || null;
    }
    if (!seen.has(n.rootConceptId)) fail(`unreachable root on ${n.id}`);
    if (
      !n.summary ||
      !n.details.length ||
      !n.sourceUrls.length ||
      n.sourceUrls.some((u) => !u.startsWith('https://'))
    )
      fail(`incomplete explanation or sources on ${n.id}`);
    for (const url of n.sourceUrls) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || !parsed.hostname)
          fail(`invalid source ${n.id}`);
      } catch {
        fail(`invalid source ${n.id}`);
      }
    }
    for (const id of n.relatedIds)
      if (!nodes.has(id) || id === n.id)
        fail(`invalid relation ${n.id} -> ${id}`);
  }
  for (const root of pack.nodes.filter((n) => !n.parentId))
    if (!lessons.has(root.id)) fail(`root lacks learning article ${root.id}`);
  const blockIds: string[] = [];
  for (const l of pack.lessons) {
    if (!nodes.has(l.id) || l.domain !== nodes.get(l.id)!.domainId)
      fail(`invalid lesson root ${l.id}`);
    if (l.design.conceptId !== l.id) fail(`visual design mismatch ${l.id}`);
    if (!l.design.cardVisual.caption || !l.design.cardVisual.title)
      fail(`unexplained card ${l.id}`);
    const lead = l.design.leadVisual;
    if (
      !lead?.title ||
      !lead.caption ||
      !['stages', 'factors', 'access-models', 'risk'].includes(lead.kind)
    )
      fail(`invalid lead visual ${l.id}`);
    if (['stages', 'factors'].includes(lead.kind) && !lead.steps?.length)
      fail(`missing visual steps ${l.id}`);
    if (lead.kind === 'access-models' && !lead.models)
      fail(`missing model scenarios ${l.id}`);
    const card = l.design.cardVisual;
    if (
      !['flow', 'comparison', 'layers', 'timeline', 'decision'].includes(
        card.kind,
      ) ||
      !card.items.length
    )
      fail(`unsupported card ${l.id}`);
    unique(
      card.items.map((i) => i.id),
      `${l.id} card item`,
    );
    for (const link of card.connections || [])
      if (
        !card.items.some((i) => i.id === link.from) ||
        !card.items.some((i) => i.id === link.to) ||
        !link.label
      )
        fail(`invalid card link ${l.id}`);
    for (const b of l.design.blocks) {
      blockIds.push(b.id);
      if (
        !Number.isInteger(b.afterSection) ||
        b.afterSection < 0 ||
        b.afterSection >= l.sections.length
      )
        fail(`invalid section ${b.id}`);
      if (b.type === 'check') {
        if (
          b.options.length !== 4 ||
          !Number.isInteger(b.correctIndex) ||
          b.correctIndex < 0 ||
          b.correctIndex > 3 ||
          !b.explanation ||
          !b.hint
        )
          fail(`invalid knowledge check ${b.id}`);
      } else if (b.type === 'diagram') {
        if (
          !['flow', 'comparison', 'layers', 'timeline', 'decision'].includes(
            b.kind,
          ) ||
          !b.caption ||
          !b.items.length
        )
          fail(`unsupported diagram ${b.id}`);
        unique(
          b.items.map((i) => i.id),
          `${b.id} item`,
        );
        for (const link of b.links)
          if (
            !b.items.some((i) => i.id === link.from) ||
            !b.items.some((i) => i.id === link.to) ||
            !link.label
          )
            fail(`dangling or unlabeled diagram connection ${b.id}`);
      } else fail('unsupported learning block');
    }
  }
  unique(blockIds, 'learning block');
  for (const q of pack.questions) {
    const m = q.metadata;
    if (
      !lessons.has(q.conceptId) ||
      m.questionId !== q.id ||
      m.domainId !== lessons.get(q.conceptId)!.domain ||
      !m.objective ||
      !m.hint ||
      !m.misconception ||
      !['foundation', 'application', 'analysis'].includes(m.difficulty) ||
      !m.tags.length ||
      !m.subtopicIds.length
    )
      fail(`incomplete question mapping ${q.id}`);
    for (const id of m.subtopicIds)
      if (!nodes.has(id)) fail(`dangling subtopic ${q.id} -> ${id}`);
    if (!m.learningLinks.length) fail(`missing learning article ${q.id}`);
    for (const link of m.learningLinks) {
      const l = lessons.get(link.lessonId);
      if (
        !l ||
        !Number.isInteger(link.sectionIndex) ||
        !l.sections[link.sectionIndex] ||
        !link.label
      )
        fail(`invalid article link ${q.id}`);
    }
    if (
      q.options.length !== 4 ||
      q.explanations.length !== 4 ||
      !Number.isInteger(q.correctIndex) ||
      q.correctIndex < 0 ||
      q.correctIndex > 3
    )
      fail(`invalid question ${q.id}`);
  }
  for (const e of pack.edges)
    if (!nodes.has(e.from) || !nodes.has(e.to) || !e.label)
      fail(`invalid peer edge ${e.from}`);
  return {
    releaseId: pack.releaseId,
    concepts: pack.nodes.length,
    lessons: pack.lessons.length,
    questions: pack.questions.length,
    diagrams: pack.lessons.reduce(
      (s, l) => s + l.design.blocks.filter((b) => b.type === 'diagram').length,
      0,
    ),
    checks: pack.lessons.reduce(
      (s, l) => s + l.design.blocks.filter((b) => b.type === 'check').length,
      0,
    ),
  };
}
