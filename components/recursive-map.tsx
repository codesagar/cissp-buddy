'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Minus,
  Plus,
  Expand,
  Search,
  Network,
  List,
  Link2,
  X,
  Move,
  Layers,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { useCurriculum } from '@/lib/content-provider';
import {
  ancestors,
  branchLayout,
  visibleBranch,
  revealPath,
  hiddenRelationships,
  descendants,
} from '@/lib/graph-model';
import type { StudyState } from '@/lib/study-state';
export function RecursiveMap({
  selectedId,
  go,
  state,
}: {
  selectedId?: string;
  go: (path: string) => void;
  state: StudyState;
}) {
  const { nodes, domains, questions, lessons, shortTitle, edges } =
    useCurriculum();
  const selected =
    nodes.find((n) => n.id === selectedId) ||
    nodes.find((n) => n.id === 'authentication')!;
  const root = nodes.find((n) => n.id === selected.rootConceptId)!;
  const [expanded, setExpanded] = useState(
      () => new Set([root.id, ...ancestors(nodes, selected.id)]),
    ),
    [query, setQuery] = useState(''),
    [view, setView] = useState('graph'),
    [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.75 });
  const viewport = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
      null,
    );
  const layout = useMemo(() => branchLayout(nodes, root.id), [nodes, root.id]);
  const effectiveExpanded = useMemo(() => {
    const next = revealPath(nodes, selected.id, expanded);
    if (!expanded.has(selected.id)) next.delete(selected.id);
    return next;
  }, [nodes, selected.id, expanded]);
  const visible = useMemo(
    () => visibleBranch(nodes, root.id, effectiveExpanded),
    [nodes, root.id, effectiveExpanded],
  );
  const visibleIds = useMemo(
    () => new Set(visible.map((n) => n.id)),
    [visible],
  );
  const hiddenByNode = useMemo(
    () =>
      new Map(
        visible.map((n) => [
          n.id,
          hiddenRelationships(nodes, n.id, visibleIds, edges),
        ]),
      ),
    [nodes, visible, visibleIds, edges],
  );
  const fit = (onlyId?: string) => {
    const el = viewport.current;
    if (!el) return;
    const targets = onlyId
      ? [layout.get(onlyId)!]
      : visible.map((n) => layout.get(n.id)!);
    const xs = targets.map((p) => p.x),
      ys = targets.map((p) => p.y);
    const left = Math.min(...xs) - 110,
      top = Math.min(...ys) - 50,
      w = Math.max(...xs) - left + 140,
      h = Math.max(...ys) - top + 60;
    const scale = Math.max(
      0.3,
      Math.min(
        1,
        Math.min((el.clientWidth - 60) / w, (el.clientHeight - 60) / h),
      ),
    );
    setTransform({
      x: (el.clientWidth - w * scale) / 2 - left * scale,
      y: (el.clientHeight - h * scale) / 2 - top * scale,
      scale,
    });
  };
  const fitRef = useRef(fit);
  useEffect(() => {
    fitRef.current = fit;
  });
  useEffect(() => {
    const frame = requestAnimationFrame(() => fitRef.current());
    return () => cancelAnimationFrame(frame);
  }, [root.id, view]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (window.matchMedia('(max-width:767px)').matches) setView('outline');
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const select = (id: string, open = true) => {
    setExpanded((s) =>
      open
        ? revealPath(nodes, id, s)
        : new Set([...s, ...ancestors(nodes, id).slice(0, -1)]),
    );
    go(`map/${id}`);
    setQuery('');
  };
  const toggle = (id: string) => {
    const closing = effectiveExpanded.has(id);
    setExpanded((s) => {
      const next = new Set(s);
      if (closing) next.delete(id);
      else next.add(id);
      return next;
    });
    if (closing && ancestors(nodes, selected.id).includes(id)) go(`map/${id}`);
  };
  const related = [
    ...selected.relatedIds.map((id) => ({
      id,
      label:
        edges.find(
          (e) =>
            (e.from === selected.id && e.to === id) ||
            (e.to === selected.id && e.from === id),
        )?.label || 'Related idea',
    })),
    ...edges
      .filter((e) => e.from === selected.id || e.to === selected.id)
      .map((e) => ({
        id: e.from === selected.id ? e.to : e.from,
        label: e.label,
      })),
  ].filter(
    (r, i, rs) =>
      nodes.some((n) => n.id === r.id) &&
      rs.findIndex((x) => x.id === r.id) === i,
  );
  const hidden = hiddenByNode.get(selected.id) || [];
  const matches = query
    ? nodes
        .filter((n) =>
          `${n.title} ${n.summary}`.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 10)
    : [];
  const targetedQuestions = questions.filter((q) =>
    q.metadata.subtopicIds.includes(selected.id),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE LIVING CONCEPT MAP</div>
          <h1>
            Go beneath the surface.
            <br />
            <em>Follow your curiosity.</em>
          </h1>
          <p>
            Open a branch, explore its parts, and discover the ideas underneath.
          </p>
        </div>
        <div className="map-count">
          <strong>{nodes.length}</strong>
          <span>
            connected ideas
            <br />
            across{' '}
            {
              domains.filter((d) => nodes.some((n) => n.domainId === d.id))
                .length
            }{' '}
            domains
          </span>
        </div>
      </div>
      <div className="explorer-shell">
        <aside className="explorer-library">
          <span className="eyebrow">YOUR KNOWLEDGE ATLAS</span>
          <div className="map-search">
            <Search size={15} />
            <input
              aria-label="Search all concepts and subtopics"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find any idea…"
            />
            {query && (
              <button
                aria-label="Clear concept search"
                onClick={() => setQuery('')}
              >
                <X size={13} />
              </button>
            )}
          </div>
          {query ? (
            <div className="graph-search-results">
              {matches.map((n) => (
                <button key={n.id} onClick={() => select(n.id)}>
                  <strong>{n.title}</strong>
                  <small>
                    {shortTitle(n.rootConceptId)} ·{' '}
                    {ancestors(nodes, n.id).length - 1} levels deep
                  </small>
                </button>
              ))}
              {!matches.length && (
                <p>No matching ideas. Try “factors” or “policy”.</p>
              )}
            </div>
          ) : (
            domains.map((d) => (
              <details
                className="atlas-domain"
                key={d.id}
                open={d.id === root.domainId}
              >
                <summary>
                  <span style={{ color: d.color }}>0{d.id}</span>
                  {d.short}
                  <small>
                    {nodes.filter((n) => n.domainId === d.id).length || 'Later'}
                  </small>
                </summary>
                {nodes
                  .filter((n) => n.domainId === d.id && !n.parentId)
                  .map((n) => (
                    <button
                      className={root.id === n.id ? 'active' : ''}
                      key={n.id}
                      onClick={() => select(n.id)}
                    >
                      <span>{n.title}</span>
                      <small>{descendants(nodes, n.id).length}</small>
                      <ChevronRight size={12} />
                    </button>
                  ))}
                {!nodes.some((n) => n.domainId === d.id) && (
                  <p>Not yet included in this release.</p>
                )}
              </details>
            ))
          )}
        </aside>
        <div className="explorer-main">
          <div className="explorer-breadcrumb">
            <span>D0{root.domainId}</span>
            {ancestors(nodes, selected.id).map((id) => (
              <span key={id}>
                <ChevronRight size={12} />
                <button onClick={() => select(id)}>{shortTitle(id)}</button>
              </span>
            ))}
          </div>
          <div className="explorer-toolbar">
            <Tabs value={view} onValueChange={(v) => setView(String(v))}>
              <TabsList className="filter-tabs">
                <TabsTrigger value="graph">
                  <Network size={14} /> Explore
                </TabsTrigger>
                <TabsTrigger value="outline">
                  <List size={14} /> Outline
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <span>
              {visible.length} visible ·{' '}
              {nodes.filter((n) => n.rootConceptId === root.id).length} in this
              branch
            </span>
            <button
              className="text-link"
              onClick={() => {
                setExpanded(new Set([root.id]));
                go(`map/${root.id}`);
                requestAnimationFrame(() => fitRef.current());
              }}
            >
              Reset branch
            </button>
          </div>
          {view === 'graph' ? (
            <div
              className="recursive-viewport"
              ref={viewport}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button,a,input')) return;
                drag.current = {
                  x: e.clientX,
                  y: e.clientY,
                  tx: transform.x,
                  ty: transform.y,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (drag.current)
                  setTransform((t) => ({
                    ...t,
                    x: drag.current!.tx + e.clientX - drag.current!.x,
                    y: drag.current!.ty + e.clientY - drag.current!.y,
                  }));
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              <div
                className="recursive-world"
                style={{
                  transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
                }}
              >
                <svg
                  className="hierarchy-lines"
                  width="3000"
                  height="12000"
                  aria-hidden="true"
                >
                  {visible
                    .filter((n) => n.parentId && visibleIds.has(n.parentId))
                    .map((n) => {
                      const p = layout.get(n.parentId!)!,
                        c = layout.get(n.id)!;
                      return (
                        <g key={n.id}>
                          <path
                            d={`M${p.x + 100},${p.y} C${p.x + 175},${p.y} ${c.x - 175},${c.y} ${c.x - 110},${c.y}`}
                            stroke="#b2c7a5"
                            fill="none"
                            strokeWidth="1.5"
                          />
                          <text
                            x={c.x - 153}
                            y={c.y - 9}
                            fill="#6e8361"
                            fontSize="10"
                          >
                            includes
                          </text>
                        </g>
                      );
                    })}
                  {visible
                    .flatMap((n) =>
                      n.relatedIds
                        .filter((id) => visibleIds.has(id))
                        .map((id) => ({ from: n.id, to: id })),
                    )
                    .filter(
                      (e, i, all) =>
                        all.findIndex(
                          (x) =>
                            [x.from, x.to].sort().join('|') ===
                            [e.from, e.to].sort().join('|'),
                        ) === i,
                    )
                    .map((e, i) => {
                      const a = layout.get(e.from)!,
                        b = layout.get(e.to)!;
                      return (
                        <path
                          key={`relation-${i}`}
                          d={`M${a.x},${a.y + 35} Q${Math.max(a.x, b.x) + 100},${(a.y + b.y) / 2} ${b.x},${b.y + 35}`}
                          stroke="#b39978"
                          strokeWidth="1.3"
                          strokeDasharray="5 5"
                          fill="none"
                        />
                      );
                    })}
                </svg>
                {visible.map((n) => {
                  const p = layout.get(n.id)!,
                    children = nodes.filter((c) => c.parentId === n.id),
                    isExpanded = effectiveExpanded.has(n.id),
                    links = (hiddenByNode.get(n.id) || []).length;
                  return (
                    <div
                      key={n.id}
                      className={`recursive-node depth-${p.depth} ${selected.id === n.id ? 'selected' : ''} ${children.length ? 'branch-node' : 'leaf-node'}`}
                      style={{ left: p.x, top: p.y }}
                    >
                      <button
                        className="node-select"
                        onClick={() => select(n.id)}
                        aria-label={`${n.title}. ${children.length ? `${children.length} sub-concepts; select to expand` : 'Leaf concept; read details'}`}
                      >
                        <span className="node-kind">
                          {p.depth === 0 ? (
                            <Layers size={12} />
                          ) : children.length ? (
                            <Network size={11} />
                          ) : (
                            <BookOpen size={11} />
                          )}{' '}
                          {p.depth === 0
                            ? 'CORE CONCEPT'
                            : children.length
                              ? 'SUB-CONCEPT'
                              : 'FOUNDATION'}
                        </span>
                        <strong>{n.title}</strong>
                        <small>
                          {children.length
                            ? `${children.length} ideas within`
                            : 'Read the distinction'}
                        </small>
                      </button>
                      {children.length > 0 && (
                        <button
                          className="node-toggle"
                          onClick={() => toggle(n.id)}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${n.title}`}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <Minus size={14} />
                          ) : (
                            <Plus size={14} />
                          )}
                        </button>
                      )}
                      {!isExpanded && links > 0 && (
                        <button
                          className="hidden-link-count"
                          onClick={() => select(n.id, false)}
                        >
                          <Link2 size={10} />
                          {links} related links inside
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="graph-controls">
                <button
                  aria-label="Zoom out"
                  onClick={() =>
                    setTransform((t) => ({
                      ...t,
                      scale: Math.max(0.25, t.scale - 0.15),
                    }))
                  }
                >
                  <Minus size={16} />
                </button>
                <span>{Math.round(transform.scale * 100)}%</span>
                <button
                  aria-label="Zoom in"
                  onClick={() =>
                    setTransform((t) => ({
                      ...t,
                      scale: Math.min(1.75, t.scale + 0.15),
                    }))
                  }
                >
                  <Plus size={16} />
                </button>
                <button aria-label="Fit visible branch" onClick={() => fit()}>
                  <Expand size={17} />
                </button>
                <button
                  onClick={() => fit(selected.id)}
                  className="locate-node"
                >
                  Find selected
                </button>
              </div>
              <div className="graph-pan-hint">
                <Move size={13} /> Drag to explore · + opens a branch
              </div>
            </div>
          ) : (
            <div className="recursive-outline">
              {visible.map((n) => {
                const depth = ancestors(nodes, n.id).length - 1,
                  hasChildren = nodes.some((c) => c.parentId === n.id);
                return (
                  <div
                    className={selected.id === n.id ? 'selected' : ''}
                    style={{ paddingLeft: 16 + depth * 22 }}
                    key={n.id}
                  >
                    {hasChildren ? (
                      <button
                        aria-label={`${effectiveExpanded.has(n.id) ? 'Collapse' : 'Expand'} ${n.title}`}
                        aria-expanded={effectiveExpanded.has(n.id)}
                        onClick={() => toggle(n.id)}
                      >
                        {effectiveExpanded.has(n.id) ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>
                    ) : (
                      <BookOpen size={14} />
                    )}
                    <button onClick={() => select(n.id)}>
                      <strong>{n.title}</strong>
                      <span>{n.summary}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="explorer-legend">
            <span>
              <i /> Contains a sub-concept
            </span>
            <span>
              <i className="peer" /> Related idea
            </span>
            <span>Expanded nodes keep their position.</span>
          </div>
        </div>
      </div>
      <section className="concept-inspector" aria-live="polite">
        <div className="inspector-main">
          <span className="eyebrow">
            {selected.parentId ? 'BENEATH THE SURFACE' : 'THE CORE IDEA'} ·
            OBJECTIVE {selected.objective}
          </span>
          <h2>{selected.title}</h2>
          <p className="inspector-summary">{selected.summary}</p>
          {selected.details.map((d, i) => (
            <div key={i}>
              <h3>{d.heading}</h3>
              <p>{d.body}</p>
            </div>
          ))}
          <div className="button-row">
            <button
              className="button"
              onClick={() => go(`learn/${selected.rootConceptId}`)}
            >
              Open learning article <ArrowUpRight size={15} />
            </button>
            {targetedQuestions.length > 0 && (
              <button
                className="button outline"
                onClick={() =>
                  go(`practice/topic/${encodeURIComponent(selected.id)}`)
                }
              >
                Practice this subtopic <ArrowRight size={15} />
              </button>
            )}
          </div>
          <details className="sources">
            <summary>Sources for this idea</summary>
            {selected.sourceUrls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                {new URL(url).hostname} · Reference <ArrowUpRight size={12} />
              </a>
            ))}
          </details>
        </div>
        <aside>
          <span className="eyebrow">LINKED THINKING</span>
          {related.length ? (
            related.map((r) => (
              <button
                className="inspector-link"
                key={r.id}
                onClick={() => select(r.id)}
              >
                <small>{r.label}</small>
                <strong>
                  {shortTitle(r.id)}
                  <ArrowUpRight size={13} />
                </strong>
              </button>
            ))
          ) : (
            <p className="muted">
              Explore the parent concept to see how this idea fits.
            </p>
          )}
          {hidden.length > 0 && (
            <div className="hidden-relations">
              <span className="eyebrow">CONNECTIONS BELOW THIS BRANCH</span>
              {hidden.slice(0, 6).map((e, i) => (
                <button
                  key={i}
                  onClick={() => select(visibleIds.has(e.to) ? e.from : e.to)}
                >
                  {shortTitle(e.from)}
                  <ArrowRight size={12} />
                  {shortTitle(e.to)}
                </button>
              ))}
            </div>
          )}
          <div className="node-evidence">
            <span className="eyebrow">PRACTICE COVERAGE</span>
            <strong>{targetedQuestions.length} linked scenarios</strong>
            <p>
              {targetedQuestions.length
                ? 'Related activity helps you find practice. It does not prove mastery of every linked idea.'
                : 'No directly tagged questions yet. This concept has reading coverage only.'}
            </p>
            <small>
              {state.completed.includes(selected.rootConceptId)
                ? 'Parent lesson completed'
                : 'Parent lesson available'}{' '}
              · {lessons.find((l) => l.id === selected.rootConceptId)?.minutes}{' '}
              min
            </small>
          </div>
        </aside>
      </section>
    </>
  );
}
