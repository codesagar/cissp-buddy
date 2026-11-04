'use client';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
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
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { MapInspector } from './map-inspector';
import { useCurriculum } from '@/lib/content-provider';
import {
  ancestors,
  branchLayout,
  visibleBranch,
  revealPath,
  hiddenRelationships,
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
    [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const viewport = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
      null,
    ),
    pointerFocus = useRef(false);
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
    const targets = (
      onlyId ? [layout.get(onlyId)] : visible.map((n) => layout.get(n.id))
    ).filter((point): point is NonNullable<typeof point> => !!point);
    if (!targets.length) return;
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
  const center = (id: string) => {
    const el = viewport.current;
    const point = layout.get(id);
    if (!el || !point) return;
    setTransform((current) => ({
      ...current,
      x: el.clientWidth * 0.4 - point.x * current.scale,
      y: el.clientHeight / 2 - point.y * current.scale,
    }));
  };
  const panGraph = (x: number, y: number) => {
    setTransform((current) => ({
      ...current,
      x: current.x + x,
      y: current.y + y,
    }));
  };
  const handleGraphKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 100 : 48;
    if (event.key === 'ArrowLeft') panGraph(step, 0);
    else if (event.key === 'ArrowRight') panGraph(-step, 0);
    else if (event.key === 'ArrowUp') panGraph(0, step);
    else if (event.key === 'ArrowDown') panGraph(0, -step);
    else if (event.key === '+' || event.key === '=') {
      setTransform((current) => ({
        ...current,
        scale: Math.min(1.75, current.scale + 0.15),
      }));
    } else if (event.key === '-') {
      setTransform((current) => ({
        ...current,
        scale: Math.max(0.25, current.scale - 0.15),
      }));
    } else return;
    event.preventDefault();
  };
  const fitRef = useRef(fit);
  const centerRef = useRef(center);
  useEffect(() => {
    fitRef.current = fit;
    centerRef.current = center;
  });
  useEffect(() => {
    const frame = requestAnimationFrame(() => centerRef.current(selected.id));
    return () => cancelAnimationFrame(frame);
  }, [root.id, selected.id, view]);
  useEffect(() => {
    const narrow = window.matchMedia('(max-width:767px)');
    const preferOutline = () => {
      if (narrow.matches) setView('outline');
    };
    preferOutline();
    narrow.addEventListener('change', preferOutline);
    return () => narrow.removeEventListener('change', preferOutline);
  }, []);
  useEffect(() => {
    const clearPointerFocus = () => {
      pointerFocus.current = false;
    };
    window.addEventListener('pointerup', clearPointerFocus, true);
    window.addEventListener('pointercancel', clearPointerFocus, true);
    return () => {
      window.removeEventListener('pointerup', clearPointerFocus, true);
      window.removeEventListener('pointercancel', clearPointerFocus, true);
    };
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
  const inverseRelationshipLabel = (label: string) =>
    ({
      supports: 'supported by',
      requires: 'required by',
      informs: 'informed by',
      'often confused with': 'often confused with',
    })[label] || 'connected to';
  const hierarchyNeighbors = new Set([
    selected.parentId,
    ...nodes
      .filter((node) => node.parentId === selected.id)
      .map((node) => node.id),
  ]);
  const linkedIds = [
    ...selected.relatedIds,
    ...nodes
      .filter((node) => node.relatedIds.includes(selected.id))
      .map((node) => node.id),
  ];
  const related = [
    ...linkedIds
      .filter(
        (id, index) =>
          !hierarchyNeighbors.has(id) && linkedIds.indexOf(id) === index,
      )
      .map((id) => ({
        id,
        label: (() => {
          const edge = edges.find((e) => e.from === selected.id && e.to === id);
          if (edge) return edge.label;
          const incoming = edges.find(
            (e) => e.to === selected.id && e.from === id,
          );
          if (!incoming) return 'Related idea';
          return inverseRelationshipLabel(incoming.label);
        })(),
      })),
    ...edges
      .filter((e) => e.from === selected.id || e.to === selected.id)
      .map((e) => ({
        id: e.from === selected.id ? e.to : e.from,
        label:
          e.from === selected.id ? e.label : inverseRelationshipLabel(e.label),
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
  const selectedDomain = domains.find(
    (domain) => domain.id === selected.domainId,
  );
  const parent = selected.parentId
    ? nodes.find((node) => node.id === selected.parentId)
    : undefined;
  const children = nodes
    .filter((node) => node.parentId === selected.id)
    .sort((a, b) => a.order - b.order);
  const selectedLesson = lessons.find(
    (lesson) => lesson.id === selected.rootConceptId,
  );
  return (
    <>
      <header className="map-page-heading">
        <div>
          <h1>Concept map</h1>
          <p>
            Explore where an idea belongs, what connects to it, and what to
            learn next.
          </p>
        </div>
        <div
          className="map-count"
          aria-label={`${nodes.length} concepts across ${domains.filter((d) => nodes.some((n) => n.domainId === d.id)).length} pilot domains`}
        >
          <strong>{nodes.length}</strong>
          <span>concepts in this pilot</span>
        </div>
      </header>
      <div className="map-navigation">
        <label className="map-root-picker">
          <span>Concept area</span>
          <select
            aria-label="Choose a domain and core concept"
            value={root.id}
            onChange={(event) => select(event.target.value)}
          >
            {domains.map((domain) => {
              const roots = nodes
                .filter((node) => node.domainId === domain.id && !node.parentId)
                .sort((a, b) => a.order - b.order);
              return (
                <optgroup
                  key={domain.id}
                  label={`Domain ${String(domain.id).padStart(2, '0')} · ${domain.name}`}
                >
                  {roots.length ? (
                    roots.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.title}
                      </option>
                    ))
                  ) : (
                    <option value={`domain-${domain.id}`} disabled>
                      Not yet included in this release
                    </option>
                  )}
                </optgroup>
              );
            })}
          </select>
        </label>
        <div className="map-search-wrap">
          <label htmlFor="map-concept-search">Search concepts in the Map</label>
          <div className="map-search">
            <Search size={16} aria-hidden="true" />
            <input
              id="map-concept-search"
              aria-controls={query ? 'map-search-results' : undefined}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && query) {
                  event.preventDefault();
                  setQuery('');
                }
              }}
              placeholder="Search concepts"
            />
            {query && (
              <button
                aria-label="Clear Map concept search"
                onClick={() => setQuery('')}
              >
                <X size={16} />
              </button>
            )}
          </div>
          {query && (
            <section
              className="graph-search-results"
              id="map-search-results"
              aria-label="Map concept search results"
              aria-live="polite"
            >
              {matches.map((node) => (
                <button key={node.id} onClick={() => select(node.id)}>
                  <strong>{node.title}</strong>
                  <small>
                    {shortTitle(node.rootConceptId)} ·{' '}
                    {ancestors(nodes, node.id).length - 1} levels deep
                  </small>
                </button>
              ))}
              {!matches.length && (
                <p>
                  No matching concepts. Try a shorter title or another term.
                </p>
              )}
            </section>
          )}
        </div>
      </div>
      <div className="explorer-shell">
        <div className="explorer-main">
          <div className="explorer-breadcrumb">
            <span>Domain {String(root.domainId).padStart(2, '0')}</span>
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
                <TabsTrigger
                  value="graph"
                  aria-label="Explore concepts as a graph"
                >
                  <Network size={14} /> Explore
                </TabsTrigger>
                <TabsTrigger
                  value="outline"
                  aria-label="Explore concepts as an outline"
                >
                  <List size={14} /> Outline
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <span>
              {visible.length} shown ·{' '}
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
                            className="edge-containment"
                            fill="none"
                            strokeWidth="1.5"
                          />
                        </g>
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
                        onPointerDown={() => {
                          pointerFocus.current = true;
                        }}
                        onClick={() => select(n.id)}
                        onFocus={() => {
                          if (!pointerFocus.current) centerRef.current(n.id);
                        }}
                        onKeyDown={handleGraphKeyDown}
                        aria-describedby="graph-pan-instructions"
                        aria-current={selected.id === n.id ? 'true' : undefined}
                        aria-label={`${n.title}. ${children.length ? `${children.length} sub-concepts; select to expand` : 'Leaf concept; read details'}`}
                      >
                        {selected.id === n.id && (
                          <span className="node-kind">Selected concept</span>
                        )}
                        <strong>{n.title}</strong>
                        {children.length > 0 && (
                          <small>{children.length} ideas within</small>
                        )}
                      </button>
                      {children.length > 0 && (
                        <button
                          className="node-toggle"
                          onClick={() => toggle(n.id)}
                          onFocus={() => centerRef.current(n.id)}
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
                          onFocus={() => centerRef.current(n.id)}
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
                  aria-label="Pan graph left"
                  onClick={() => panGraph(-48, 0)}
                  title="Pan graph left"
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  aria-label="Pan graph up"
                  onClick={() => panGraph(0, 48)}
                  title="Pan graph up"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  aria-label="Pan graph down"
                  onClick={() => panGraph(0, -48)}
                  title="Pan graph down"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  aria-label="Pan graph right"
                  onClick={() => panGraph(48, 0)}
                  title="Pan graph right"
                >
                  <ArrowRight size={16} />
                </button>
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
                  onClick={() => center(selected.id)}
                  className="locate-node"
                >
                  Find selected
                </button>
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
                    <button
                      onClick={() => select(n.id)}
                      aria-current={selected.id === n.id ? 'true' : undefined}
                    >
                      <strong>{n.title}</strong>
                      <span>{n.summary}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {view === 'graph' && (
            <p className="graph-pan-hint" id="graph-pan-instructions">
              <Move size={13} /> Drag to move the map. Focus a node and use the
              arrow keys, or choose a pan control. Use +/− to zoom.
            </p>
          )}
          <div className="explorer-legend">
            <span>
              <i /> Contains a sub-concept
            </span>
            <span>Selected concept links appear in Connected ideas.</span>
            <span>Expanded nodes keep their position.</span>
          </div>
        </div>
        <MapInspector
          selected={selected}
          domain={selectedDomain}
          parent={parent}
          childConcepts={children}
          related={related}
          hidden={hidden}
          visibleIds={visibleIds}
          practiceCount={targetedQuestions.length}
          lesson={selectedLesson}
          state={state}
          shortTitle={shortTitle}
          select={select}
          openLesson={() => go(`learn/${selected.rootConceptId}`)}
          openPractice={() =>
            go(`practice/topic/${encodeURIComponent(selected.id)}`)
          }
        />
      </div>
    </>
  );
}
