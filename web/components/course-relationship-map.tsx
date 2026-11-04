'use client';
/* eslint-disable jsx-a11y/prefer-tag-over-role -- Inline SVG needs role=img to expose its title/description; replacing it with img would discard editable diagram semantics. */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard users must be able to scroll a locally overflowing figure; equivalent text is provided immediately after it. */
import { useId, useState } from 'react';
import type { TeachingModel, TeachingState } from '@/lib/course/types';
import {
  wrapDiagramLabel as lines,
  relationshipLayout,
  relationshipRoute,
} from '@/lib/course/diagram-layout';
export function RelationshipMap({
  model,
  state,
  factsOnly = false,
}: {
  model: TeachingModel;
  state: TeachingState;
  factsOnly?: boolean;
}) {
  const uid = useId().replaceAll(':', '');
  const [selection, setSelection] = useState<{
    stateId: string;
    edge: number;
  } | null>(null);
  if (factsOnly) {
    const groups = (model.lanes || []).filter((lane) =>
      model.nodes.some((node) => node.lane === lane.id),
    );
    const ungrouped = model.nodes.filter(
      (node) => !groups.some((lane) => lane.id === node.lane),
    );
    return (
      <div className="case-entity-groups" aria-label="Visible case entities">
        {groups.map((lane) => (
          <section className="case-entity-boundary" key={lane.id}>
            <h4>{lane.label}</h4>
            <ul className="case-entity-list">
              {model.nodes
                .filter((node) => node.lane === lane.id)
                .map((node) => (
                  <li key={node.id}>{node.label}</li>
                ))}
            </ul>
          </section>
        ))}
        {ungrouped.length > 0 && (
          <ul className="case-entity-list case-entities-ungrouped">
            {ungrouped.map((node) => (
              <li key={node.id}>{node.label}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  const guidedEdgeIndex = state.activeEdgeIndexes?.[0];
  const inspecting = selection?.stateId === state.id;
  const edgeIndex = inspecting ? selection.edge : guidedEdgeIndex;
  const edge = edgeIndex === undefined ? undefined : model.edges[edgeIndex];
  const layout = relationshipLayout(model);
  const { width, height, nodeW, nodeH, positions, laneMode, lanes } = layout;
  const fromNode = model.nodes.find((n) => n.id === edge?.from),
    toNode = model.nodes.find((n) => n.id === edge?.to);
  const blocked = edge?.kind === 'blocked';
  return (
    <div className="relationship-map">
      {edge && (
        <div className="relation-inspector">
          <label htmlFor={`${uid}-select`}>
            Inspect a relationship
            <select
              id={`${uid}-select`}
              value={edgeIndex}
              onChange={(e) =>
                setSelection({
                  stateId: state.id,
                  edge: Number(e.target.value),
                })
              }
            >
              {model.edges.map((e, i) => (
                <option key={i} value={i}>
                  {i + 1}. {e.label}
                </option>
              ))}
            </select>
          </label>
          <div className="selected-relation-detail">
            <span className="relation-mode">
              {inspecting ? 'Free relation inspection' : 'Guided step'}
            </span>
            <p>
              <strong>{fromNode?.label}</strong>
              <span>
                {' '}
                {edge.kind === 'blocked' ? '— blocked path: ' : '→ '}
                {edge.label} {blocked ? '— before ' : '→ '}
              </span>
              <strong>{toNode?.label}</strong>
            </p>
            <dl>
              <div>
                <dt>Condition</dt>
                <dd>{state.statuses?.[edge.from] || fromNode?.detail}</dd>
              </div>
              <div>
                <dt>Consequence</dt>
                <dd>{state.statuses?.[edge.to] || toNode?.detail}</dd>
              </div>
            </dl>
            {inspecting && (
              <button
                className="text-button"
                onClick={() => setSelection(null)}
              >
                Return to guided step
              </button>
            )}
          </div>
        </div>
      )}
      <p className="figure-scroll-hint">
        Scroll the figure sideways when needed. A complete text version follows.
      </p>
      <section
        className="relationship-canvas"
        tabIndex={0}
        aria-label="Relationship diagram. Use the text equivalent below if the canvas is wider than your screen."
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ minWidth: width }}
          role="img"
          aria-labelledby={`${uid}-title ${uid}-desc`}
        >
          <title id={`${uid}-title`}>{model.title}</title>
          <desc id={`${uid}-desc`}>
            {edge
              ? `${fromNode?.label}: ${edge.label}: ${toNode?.label}. `
              : ''}
            {factsOnly
              ? 'Visible case entities. Outcome relationships are not revealed yet.'
              : laneMode
                ? lanes.map((l) => `${l.label}: ${l.rule}`).join(' ')
                : model.focalRelation}{' '}
            {!factsOnly &&
              'One selected relationship is drawn at a time to preserve its endpoints; every labeled relationship is available in the selector and text equivalent.'}
          </desc>
          <defs>
            <marker
              id={`${uid}-arrow`}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0 0L8 4L0 8Z" fill="currentColor" />
            </marker>
            <marker
              id={`${uid}-stop`}
              markerWidth="10"
              markerHeight="14"
              refX="5"
              refY="7"
              orient="auto"
            >
              <path
                d="M5 0V14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </marker>
          </defs>
          {lanes.map((l, i) => (
            <g key={l.id}>
              <rect
                x={(i * width) / lanes.length + 8}
                y="8"
                width={width / lanes.length - 16}
                height={height - 54}
                rx="9"
                className="map-lane"
              />
              {lines(l.label, 22).map((line, j) => (
                <text
                  key={j}
                  x={((i + 0.5) * width) / lanes.length}
                  y={37 + j * 19}
                  textAnchor="middle"
                  className="map-lane-label"
                >
                  {line}
                </text>
              ))}
            </g>
          ))}
          {model.edges.map((candidate, candidateIndex) => {
            const route = relationshipRoute(model, candidateIndex, layout).path;
            if (!route) return null;
            const selected = candidateIndex === edgeIndex;
            const candidateBlocked = candidate.kind === 'blocked';
            return (
              <path
                key={`${candidate.from}-${candidate.to}-${candidateIndex}`}
                d={route}
                className={`map-edge ${selected ? 'is-selected' : 'is-context'} ${candidateBlocked ? 'blocked' : ''}`}
                markerEnd={`url(#${uid}-${candidateBlocked ? 'stop' : 'arrow'})`}
                strokeDasharray={
                  candidate.kind === 'dependency' ||
                  candidate.kind === 'evidence' ||
                  candidateBlocked
                    ? '6 4'
                    : undefined
                }
              />
            );
          })}
          {model.nodes.map((n) => {
            const p = positions.get(n.id)!;
            const active =
              state.activeNodeIds.includes(n.id) ||
              edge?.from === n.id ||
              edge?.to === n.id;
            return (
              <g
                key={n.id}
                className={active ? 'map-entity is-focused' : 'map-entity'}
              >
                <rect
                  x={p.x}
                  y={p.y}
                  width={nodeW}
                  height={nodeH}
                  rx={model.representation === 'state' ? 22 : 8}
                  className="map-entity-box"
                />
                {lines(n.label, 25).map((line, j) => (
                  <text
                    key={j}
                    x={p.x + nodeW / 2}
                    y={p.y + 32 + j * 20}
                    textAnchor="middle"
                    className="map-entity-label"
                  >
                    {line}
                  </text>
                ))}
                {edge?.from === n.id && (
                  <text
                    x={p.x + 12}
                    y={p.y + nodeH - 9}
                    className="map-endpoint"
                  >
                    FROM
                  </text>
                )}
                {edge?.to === n.id && (
                  <text
                    x={p.x + nodeW - 12}
                    y={p.y + nodeH - 9}
                    textAnchor="end"
                    className="map-endpoint"
                  >
                    {edge.kind === 'blocked' ? 'NOT REACHED' : 'TO'}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </section>
      {laneMode && !factsOnly && (
        <div className="boundary-rules">
          {lanes.map((l) => (
            <p key={l.id}>
              <strong>{l.label}.</strong> {l.rule}
            </p>
          ))}
        </div>
      )}
      {!factsOnly && (
        <div className="map-state-detail">
          <h4>{inspecting ? 'Guided context remains in view' : state.title}</h4>
          <p>{state.caption}</p>
          {Object.entries(state.statuses || {}).map(([id, status]) => (
            <p key={id}>
              <strong>{model.nodes.find((n) => n.id === id)?.label}:</strong>{' '}
              {status}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
