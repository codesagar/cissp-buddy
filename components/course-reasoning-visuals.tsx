"use client";
/* eslint-disable jsx-a11y/prefer-tag-over-role -- The authored floor plan is an inline explanatory image with an adjacent text equivalent. */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Wide tables are keyboard-scrollable regions and reflow into cards on narrow screens. */
import { useId } from "react";
import type {
  TeachingEvidenceRecord,
  TeachingMatrix,
  TeachingSpatialPlan,
  TeachingState,
} from "@/lib/course/types";

export function ReasoningMatrix({
  matrix,
  state,
}: {
  matrix: TeachingMatrix;
  state: TeachingState;
}) {
  const active = new Set(state.activeRowIds || []);
  return (
    <section
      className="reasoning-matrix"
      aria-labelledby={`matrix-${state.id}`}
    >
      <header>
        <h4 id={`matrix-${state.id}`}>{matrix.title}</h4>
        <p>{matrix.description}</p>
      </header>
      <div
        className="reasoning-matrix-scroll"
        role="region"
        tabIndex={0}
        aria-label={`${matrix.title}. Scroll horizontally if needed.`}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Case or option</th>
              {matrix.columns.map((column) => (
                <th scope="col" key={column.id}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr
                key={row.id}
                className={active.has(row.id) ? "is-focused" : undefined}
              >
                <th scope="row">{row.label}</th>
                {matrix.columns.map((column) => (
                  <td key={column.id} data-label={column.label}>
                    {row.cells[column.id] || "Not stated"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!!matrix.notes?.length && (
        <ul className="reasoning-notes">
          {matrix.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function EvidenceRecord({ record }: { record: TeachingEvidenceRecord }) {
  return (
    <aside className="evidence-record" aria-label={record.title}>
      <h4>{record.title}</h4>
      <dl>
        {record.fields.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
      <p>{record.note}</p>
    </aside>
  );
}

export function SpatialPlan({ plan }: { plan: TeachingSpatialPlan }) {
  const uid = useId().replaceAll(":", "");
  const labelPosition = {
    entry: { x: 40, y: 88, textAnchor: "start" as const },
    egress: { x: 506, y: 366, textAnchor: "start" as const },
    reentry: { x: 608, y: 278, textAnchor: "end" as const },
  };
  return (
    <section className="spatial-plan">
      <header>
        <h4>{plan.title}</h4>
        <p>{plan.description}</p>
      </header>
      <svg
        viewBox="0 0 760 400"
        role="img"
        aria-labelledby={`${uid}-title ${uid}-desc`}
      >
        <title id={`${uid}-title`}>{plan.title}</title>
        <desc id={`${uid}-desc`}>
          {plan.description} {plan.notes.join(" ")}
        </desc>
        <defs>
          <marker
            id={`${uid}-entry`}
            className="plan-marker-entry"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0 0L8 4L0 8Z" />
          </marker>
          <marker
            id={`${uid}-egress`}
            className="plan-marker-egress"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0 0L8 4L0 8Z" />
          </marker>
          <marker
            id={`${uid}-reentry`}
            className="plan-marker-reentry"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0 0L8 4L0 8Z" />
          </marker>
        </defs>
        {plan.paths.map((path) => (
          <g key={path.id} className={`plan-path plan-${path.kind}`}>
            <polyline
              points={path.points}
              markerEnd={`url(#${uid}-${path.kind})`}
            />
            <text
              x={labelPosition[path.kind].x}
              y={labelPosition[path.kind].y}
              textAnchor={labelPosition[path.kind].textAnchor}
            >
              {path.label}
            </text>
          </g>
        ))}
        {plan.locations.map((location) => {
          const labelLines = location.label.includes(" + ")
            ? location.label
                .split(" + ")
                .map((line, index) => (index === 0 ? line : `+ ${line}`))
            : [location.label];
          const centerX = location.x + location.width / 2;
          const firstLineY =
            location.y + location.height / 2 - (labelLines.length - 1) * 9;

          return (
            <g
              key={location.id}
              className={`plan-location plan-${location.kind}`}
            >
              <rect
                x={location.x}
                y={location.y}
                width={location.width}
                height={location.height}
                rx="8"
              />
              <text x={centerX} y={firstLineY} textAnchor="middle">
                {labelLines.map((line, index) => (
                  <tspan key={line} x={centerX} dy={index === 0 ? 0 : 18}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="reasoning-notes">
        {plan.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}
