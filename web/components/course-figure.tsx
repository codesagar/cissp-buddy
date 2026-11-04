'use client';
/* eslint-disable jsx-a11y/prefer-tag-over-role -- Inline SVG and count partitions expose authored image semantics; replacing them with img would discard the editable figure. */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard users must be able to focus and scroll these local figure regions; complete text equivalents follow. */
import { useId, useState } from 'react';
import { RelationshipMap } from './course-relationship-map';
import { RecoveryTimeline } from './course-recovery-timeline';
import {
  EvidenceRecord,
  ReasoningMatrix,
  SpatialPlan,
} from './course-reasoning-visuals';
import { ArrowRight, ChevronRight, CircleStop } from 'lucide-react';
import type {
  TeachingModel,
  TeachingNode,
  TeachingState,
} from '@/lib/course/types';

type Props = {
  model: TeachingModel;
  state: TeachingState;
  complete: boolean;
  beforePrediction?: boolean;
};
function Node({
  node,
  state,
  complete,
}: {
  node: TeachingNode;
  state: TeachingState;
  complete: boolean;
}) {
  const focused = complete || state.activeNodeIds.includes(node.id);
  return (
    <article
      className={`teaching-node ${focused ? 'is-focused' : ''}`}
      data-node={node.id}
    >
      <h4>{node.label}</h4>
      {state.statuses?.[node.id] && (
        <strong className="node-status">{state.statuses[node.id]}</strong>
      )}
      <p>{node.detail}</p>
    </article>
  );
}
function Relationships({ model, state, complete }: Props) {
  if (!model.edges.length) return null;
  const names = Object.fromEntries(model.nodes.map((n) => [n.id, n.label]));
  return (
    <div className="figure-relations" aria-label="Labeled relationships">
      {model.edges.map((e, index) => (
        <div
          className={`figure-relation ${complete || state.activeEdgeIndexes?.includes(index) ? 'is-focused' : ''}`}
          key={`${e.from}-${e.to}-${index}`}
        >
          <span>{names[e.from] || e.from}</span>
          <span className="relation-verb">
            {e.kind === 'blocked' ? (
              <CircleStop size={18} aria-hidden="true" />
            ) : (
              <ArrowRight size={20} aria-hidden="true" />
            )}
            <span>{e.label}</span>
          </span>
          <span>{names[e.to] || e.to}</span>
        </div>
      ))}
    </div>
  );
}
function Sequence({ model, state, complete }: Props) {
  const id = useId().replaceAll(':', '');
  const width = Math.max(640, model.nodes.length * 152);
  const gap = width / model.nodes.length;
  const names = Object.fromEntries(
    model.nodes.map((n, i) => [n.id, { ...n, x: gap * (i + 0.5) }]),
  );
  function wrap(label: string, size: number) {
    const words = label.split(' '),
      lines = [''];
    for (const word of words) {
      const last = lines.length - 1;
      if ((lines[last] + word).length > size) lines.push(word);
      else lines[last] += `${lines[last] ? ' ' : ''}${word}`;
    }
    return lines;
  }
  const actorHeight = Math.max(
    72,
    ...model.nodes.map((node) => wrap(node.label, 17).length * 19 + 30),
  );
  const messageLabels = model.edges.map((edge) => {
    const from = names[edge.from],
      to = names[edge.to];
    return wrap(
      edge.label,
      Math.max(24, Math.floor(Math.abs((to?.x ?? 0) - (from?.x ?? 0)) / 8)),
    );
  });
  const messageY = messageLabels.map(
    (_, index) =>
      actorHeight +
      60 +
      messageLabels
        .slice(0, index + 1)
        .reduce((sum, label) => sum + label.length * 18 + 28, 0),
  );
  const height = (messageY.at(-1) ?? actorHeight + 60) + 46;
  return (
    <>
      <p className="figure-scroll-hint">
        Scroll the figure sideways when needed. A complete text version follows.
      </p>
      <div
        className="sequence-scroll"
        role="region"
        tabIndex={0}
        aria-label="Sequence diagram. Scroll horizontally if needed; the complete text equivalent follows."
      >
        {/* Inline SVG needs an image role for its accessible title and description. */}
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
        <svg
          className="sequence-svg"
          width={width}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby={`${id}-title ${id}-desc`}
        >
          <title id={`${id}-title`}>{model.title}</title>
          <desc id={`${id}-desc`}>
            {model.focalRelation}. Arrows are labeled messages or dependencies;
            vertical spacing is reading order, not elapsed time.
          </desc>
          <defs>
            <marker
              id={`${id}-arrow`}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0 0L8 4L0 8Z" fill="currentColor" />
            </marker>
          </defs>
          {model.nodes.map((n, i) => (
            <g
              key={n.id}
              className={
                complete || state.activeNodeIds.includes(n.id)
                  ? 'is-focused'
                  : ''
              }
            >
              <line
                x1={gap * (i + 0.5)}
                y1={actorHeight + 16}
                x2={gap * (i + 0.5)}
                y2={height - 16}
                stroke="currentColor"
                strokeDasharray="4 6"
                opacity=".22"
              />
              <rect
                x={gap * i + 8}
                y={8}
                width={gap - 16}
                height={actorHeight}
                rx={8}
                className="sequence-actor"
              />
              {wrap(n.label, 17).map((line, j) => (
                <text
                  key={j}
                  x={gap * (i + 0.5)}
                  y={34 + j * 19}
                  textAnchor="middle"
                  fontSize="15"
                >
                  {line}
                </text>
              ))}
            </g>
          ))}
          {model.edges.map((e, i) => {
            const from = names[e.from],
              to = names[e.to];
            if (!from || !to) return null;
            const y = messageY[i],
              active = complete || state.activeEdgeIndexes?.includes(i);
            const mid = (from.x + to.x) / 2,
              labelLines = messageLabels[i];
            return (
              <g
                key={i}
                className={
                  active ? 'sequence-message is-focused' : 'sequence-message'
                }
              >
                {labelLines.map((line, j) => (
                  <g key={j}>
                    <rect
                      x={mid - line.length * 3.9 - 5}
                      y={y - 29 - (labelLines.length - 1 - j) * 18}
                      width={line.length * 7.8 + 10}
                      height={18}
                      className="label-mask"
                    />
                    <text
                      x={mid}
                      y={y - 15 - (labelLines.length - 1 - j) * 18}
                      textAnchor="middle"
                      fontSize="14"
                    >
                      {line}
                    </text>
                  </g>
                ))}
                <path
                  d={
                    from.x === to.x
                      ? `M${from.x} ${y}h48v18h-48`
                      : `M${from.x} ${y}H${to.x + (to.x > from.x ? -1 : 1) * (e.kind === 'blocked' ? 24 : 4)}`
                  }
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2.5 : 1.5}
                  strokeDasharray={
                    e.kind === 'dependency' || e.kind === 'evidence'
                      ? '5 4'
                      : undefined
                  }
                  markerEnd={
                    e.kind === 'blocked' ? undefined : `url(#${id}-arrow)`
                  }
                />
                {e.kind === 'blocked' && (
                  <path
                    d={`M${to.x + (to.x > from.x ? -24 : 24)} ${y - 8}v16`}
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <details className="figure-equivalent">
        <summary>Read the sequence as text</summary>
        <Relationships model={model} state={state} complete={complete} />
        <div className="node-grid">
          {model.nodes.map((n) => (
            <Node key={n.id} node={n} state={state} complete={complete} />
          ))}
        </div>
      </details>
    </>
  );
}
export function CourseFigure({
  model,
  state,
  complete,
  beforePrediction = false,
}: Props) {
  const [detail, setDetail] = useState(false);
  if (beforePrediction) {
    const unresolvedPlaceholder =
      'Relevant actor, boundary, evidence source, or alternative; its outcome remains unresolved at prediction time.';
    const visibleFacts =
      model.openingFacts?.filter(
        (fact) => fact.value !== unresolvedPlaceholder,
      ) || [];
    const unresolvedFacts =
      model.openingFacts?.filter(
        (fact) => fact.value === unresolvedPlaceholder,
      ) || [];
    const facts: TeachingModel = {
      ...model,
      focalRelation:
        'Case facts. Predict what follows before revealing the remaining explanation.',
      nodes: model.nodes
        .filter((n) => state.activeNodeIds.includes(n.id))
        .map((n) => ({ ...n, detail: '' })),
      edges: [],
    };
    facts.lanes = model.lanes?.filter((l) =>
      facts.nodes.some((n) => n.lane === l.id),
    );
    const factualState = { ...state, statuses: {}, activeEdgeIndexes: [] };
    return (
      <figure
        className="course-figure figure-case-facts"
        data-representation={model.representation}
        aria-label={`${model.title}: case facts`}
      >
        <div className="figure-heading">
          <h3>Case facts</h3>
        </div>
        {model.openingFacts?.length ? (
          visibleFacts.length > 0 && (
            <div className="opening-fact-grid" aria-label="Neutral case facts">
              {visibleFacts.map((fact) => (
                <article key={fact.label}>
                  <h4>{fact.label}</h4>
                  <p>{fact.value}</p>
                </article>
              ))}
            </div>
          )
        ) : model.quantitative ? (
          <RecoveryTimeline data={model.quantitative} factual />
        ) : (
          <RelationshipMap model={facts} state={factualState} factsOnly />
        )}
        <details className="figure-equivalent">
          <summary>Read the case facts as text</summary>
          {visibleFacts.length > 0 && (
            <dl>
              {visibleFacts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {unresolvedFacts.length > 0 && (
            <div className="unresolved-case-facts">
              <p>{unresolvedPlaceholder}</p>
              <ul>
                {unresolvedFacts.map((fact) => (
                  <li key={fact.label}>{fact.label}</li>
                ))}
              </ul>
            </div>
          )}
          <ul>
            {facts.nodes.map((n) => (
              <li key={n.id}>
                <strong>{n.label}</strong>
              </li>
            ))}
          </ul>
          {facts.edges.map((e, i) => (
            <p key={i}>
              {facts.nodes.find((n) => n.id === e.from)?.label}: {e.label}:{' '}
              {facts.nodes.find((n) => n.id === e.to)?.label}
            </p>
          ))}
        </details>
      </figure>
    );
  }
  return (
    <figure
      className={`course-figure figure-${model.representation}`}
      aria-label={model.title}
      data-representation={model.representation}
    >
      <div className="figure-heading">
        <h3>{model.title}</h3>
        <button
          className="text-button"
          onClick={() => setDetail(!detail)}
          aria-expanded={detail}
        >
          {detail ? 'Hide' : 'Show'} diagram guide
        </button>
      </div>
      {detail && (
        <p className="figure-guide">
          Highlighting directs attention; it does not prove an event occurred.
          Every connection states its meaning. The case caption explains the
          current outcome.{' '}
          {model.representation === 'sequence'
            ? 'Vertical spacing is reading order, not elapsed time.'
            : ''}
        </p>
      )}
      {model.spatialPlan ? (
        <SpatialPlan plan={model.spatialPlan} />
      ) : model.matrix ? (
        <ReasoningMatrix matrix={model.matrix} state={state} />
      ) : model.quantitative ? (
        <RecoveryTimeline data={model.quantitative} />
      ) : model.representation === 'sequence' ? (
        <Sequence model={model} state={state} complete={complete} />
      ) : model.representation === 'comparison' ? (
        <div className="comparison-pairs" aria-label="Compared relationships">
          {model.edges.map((edge, i) => {
            const from = model.nodes.find((n) => n.id === edge.from)!,
              to = model.nodes.find((n) => n.id === edge.to)!;
            return (
              <div
                className={`comparison-pair ${state.activeEdgeIndexes?.includes(i) ? 'is-focused' : ''}`}
                key={i}
              >
                <div>
                  <h4>{from.label}</h4>
                  <p>{state.statuses?.[from.id] || from.detail}</p>
                </div>
                <div className="comparison-relation">
                  {edge.kind === 'blocked' ? (
                    <CircleStop size={20} />
                  ) : (
                    <ArrowRight size={20} />
                  )}
                  <strong>{edge.label}</strong>
                </div>
                <div>
                  <h4>{to.label}</h4>
                  <p>{state.statuses?.[to.id] || to.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <RelationshipMap model={model} state={state} />
      )}
      {model.evidenceRecord && <EvidenceRecord record={model.evidenceRecord} />}
      {model.representation !== 'sequence' && (
        <details className="figure-equivalent">
          <summary>Every entity and relationship as text</summary>
          <div className="node-grid">
            {model.nodes.map((n) => (
              <Node key={n.id} node={n} state={state} complete={complete} />
            ))}
          </div>
          <Relationships model={model} state={state} complete={complete} />
        </details>
      )}
      <figcaption>
        <ChevronRight size={20} aria-hidden="true" />
        <span>{model.focalRelation}</span>
      </figcaption>
      {detail && model.learningJob && (
        <div className="learning-job">
          <p>
            <strong>Plain explanation.</strong>{' '}
            {model.learningJob.plainExplanation}
          </p>
          <p>
            <strong>What the visual adds.</strong>{' '}
            {model.learningJob.visualReasoningGain}
          </p>
        </div>
      )}
    </figure>
  );
}
