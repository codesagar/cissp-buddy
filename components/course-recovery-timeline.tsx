'use client';
/* eslint-disable jsx-a11y/prefer-tag-over-role -- Editable SVG exposes its title and description as a single accessible image. */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The local figure scroll region needs keyboard focus and has a complete text equivalent. */
import { useId } from 'react';
import type { TeachingModel } from '@/lib/course/types';
export function RecoveryTimeline({
  data,
  factual = false,
}: {
  data: NonNullable<TeachingModel['quantitative']>;
  factual?: boolean;
}) {
  const id = useId().replaceAll(':', '');
  const {
    lastRecoverableAt,
    rpoLimit,
    restoreAt,
    rtoLimit,
    disruptionLimit,
    acceptanceAt,
    unit,
  } = data;
  const min = Math.min(lastRecoverableAt, -rpoLimit),
    max = Math.max(disruptionLimit, acceptanceAt, restoreAt, rtoLimit);
  const x = (value: number) => 100 + ((value - min) / (max - min)) * 680;
  const dataLoss = -lastRecoverableAt;
  const rows = [
    {
      label: 'Recoverable data',
      from: lastRecoverableAt,
      to: 0,
      y: 100,
      result: `${dataLoss} ${unit} old at disruption`,
      pass: dataLoss <= rpoLimit,
    },
    {
      label: 'Technical restoration',
      from: 0,
      to: restoreAt,
      y: 205,
      result: `Restored at +${restoreAt} ${unit}`,
      pass: true,
      qualifier: 'component result only',
    },
    {
      label: 'Accepted business service',
      from: 0,
      to: acceptanceAt,
      y: 310,
      result: `Accepted at +${acceptanceAt} ${unit}`,
      pass: acceptanceAt <= rtoLimit && acceptanceAt <= disruptionLimit,
      qualifier:
        acceptanceAt <= rtoLimit && acceptanceAt <= disruptionLimit
          ? 'within RTO and maximum disruption'
          : 'outside at least one recovery target',
    },
  ];
  return (
    <div className="recovery-timeline">
      <p>
        {factual
          ? 'Compare the observed timestamps with the three stated recovery targets.'
          : data.description}
      </p>
      <p className="figure-scroll-hint">
        Scroll sideways to compare the full time scale. Every value is also
        listed below.
      </p>
      <section
        className="relationship-canvas"
        tabIndex={0}
        aria-label="Recovery targets and observed intervals. Scroll within this figure; all quantities also appear below."
      >
        <svg
          viewBox="0 0 880 410"
          style={{ minWidth: 880 }}
          role="img"
          aria-labelledby={`${id}-title ${id}-desc`}
        >
          <title
            id={`${id}-title`}
          >{`Recovery objectives and actual recovery, measured in ${unit}`}</title>
          <desc id={`${id}-desc`}>
            Disruption is time zero. RPO permits {rpoLimit} {unit} of data loss;
            actual recoverable data is {dataLoss} {unit} old. RTO for usable
            service is {rtoLimit} {unit}; technical restoration alone takes{' '}
            {restoreAt}. Maximum tolerable disruption is {disruptionLimit}{' '}
            {unit}; business acceptance occurs at {acceptanceAt}.
          </desc>
          <line
            x1={x(0)}
            x2={x(0)}
            y1="45"
            y2="365"
            stroke="currentColor"
            strokeWidth="2"
          />
          <text x={x(0)} y="25" textAnchor="middle" className="timeline-tick">
            Disruption · 0
          </text>
          {rows.map((r) => (
            <g key={r.label}>
              <text x="20" y={r.y - 56} className="timeline-label">
                {r.label}
              </text>
              <line
                x1="90"
                x2="790"
                y1={r.y}
                y2={r.y}
                className="timeline-rail"
              />
              <line
                x1={x(r.from)}
                x2={x(r.to)}
                y1={r.y}
                y2={r.y}
                className={`timeline-interval ${factual || r.pass ? '' : 'outside-target'}`}
              />
              <circle cx={x(r.from)} cy={r.y} r="5" fill="currentColor" />
              <circle cx={x(r.to)} cy={r.y} r="5" fill="currentColor" />
              <text x="20" y={r.y + 29} className="timeline-result">
                {r.result} ·{' '}
                {factual
                  ? 'observed value'
                  : r.qualifier || (r.pass ? 'within RPO' : 'outside RPO')}
              </text>
            </g>
          ))}
          {[
            { value: -rpoLimit, y: 100, label: `RPO: −${rpoLimit}` },
            { value: rtoLimit, y: 310, label: `RTO: +${rtoLimit}` },
            {
              value: disruptionLimit,
              y: 310,
              label: `Maximum: +${disruptionLimit}`,
            },
          ].map((t) => (
            <g key={t.label}>
              <line
                x1={x(t.value)}
                x2={x(t.value)}
                y1={t.y - 15}
                y2={t.y + 15}
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="3 3"
              />
              <text
                x={x(t.value)}
                y={t.y - 22}
                textAnchor="middle"
                className="timeline-tick"
              >
                {t.label}
              </text>
            </g>
          ))}
          <text x="440" y="390" textAnchor="middle" className="timeline-tick">
            One shared linear scale · {unit} relative to disruption · diagram
            pacing is not elapsed time
          </text>
        </svg>
      </section>
      <dl className="timeline-values">
        <div>
          <dt>Recoverable data / RPO limit</dt>
          <dd>
            {dataLoss} / {rpoLimit} {unit}
          </dd>
        </div>
        <div>
          <dt>Technical restoration only</dt>
          <dd>
            {restoreAt} {unit}
          </dd>
        </div>
        <div>
          <dt>Business acceptance / RTO</dt>
          <dd>
            {acceptanceAt} / {rtoLimit} {unit}
          </dd>
        </div>
        <div>
          <dt>Business acceptance / maximum disruption</dt>
          <dd>
            {acceptanceAt} / {disruptionLimit} {unit}
          </dd>
        </div>
      </dl>
      <p className="figure-guide">
        Targets describe acceptable outcomes; observations show this case.
        Technical restoration alone does not establish that the business service
        is usable and accepted.
      </p>
    </div>
  );
}
