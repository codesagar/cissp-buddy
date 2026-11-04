'use client';
/* eslint-disable jsx-a11y/prefer-tag-over-role -- Editable SVG and count partitions expose complete image semantics with adjacent text equivalents. */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The wide UTC timeline is keyboard-scrollable and has an equivalent data table. */
import { useId, useRef, useState } from 'react';
import type { UnitPosition } from '@/lib/course/learner-state';
import {
  accountEvidence,
  evidencePaths,
  eventTimelineModel,
  samplingModel,
  summarizeSample,
  utcClock,
} from '@/lib/course/evidence-models';
import type {
  EvidenceResult,
  SampleEvidence,
} from '@/lib/course/evidence-models';
type Props = {
  position: UnitPosition;
  update: (patch: Partial<UnitPosition>) => void;
};
const resultLabels: Record<EvidenceResult, string> = {
  pass: 'Observed pass',
  failure: 'Observed failure',
  missing: 'Missing / not tested',
  exception: 'Exception to reconcile',
};
function readEvidence(raw: unknown): SampleEvidence {
  try {
    const parsed = JSON.parse(typeof raw === 'string' ? raw : '{}');
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object')
      return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, v]) =>
        Object.hasOwn(resultLabels, String(v)),
      ),
    ) as SampleEvidence;
  } catch {
    return {};
  }
}
export function SamplingLab({ position, update }: Props) {
  const uid = useId(),
    inputs = position.exploration || {},
    seed = String(inputs.sampleSeed ?? '20260630'),
    data = samplingModel(seed),
    evidence = readEvidence(inputs.sampleEvidence);
  const set = (key: string, value: string) =>
    update({ exploration: { ...inputs, [key]: value } });
  const group = String(inputs.sampleGroup || 'human');
  const ids = data.valid
    ? group === 'service'
      ? data.serviceAccounts
      : group === 'break-glass'
        ? data.breakGlassAccounts
        : data.selected
    : [];
  const account = ids.includes(String(inputs.sampleAccount))
    ? String(inputs.sampleAccount)
    : ids[0];
  const criteria =
    group === 'service'
      ? [
          'Identity registration',
          'Credential presentation',
          'Bypass paths',
          'Key or secret rotation',
          'Service activity records',
        ]
      : group === 'break-glass'
        ? [
            'Account assignment',
            'Emergency authentication',
            'Override approval',
            'Reset after use',
            'Monitored sign-in',
          ]
        : [
            'Enrollment',
            'Interactive challenge',
            'Bypass paths',
            'Reset paths',
            'Sign-in evidence',
          ];
  const totals = data.valid ? summarizeSample(data.selected, evidence) : null;
  return (
    <section
      className="course-lab sampling-lab"
      aria-label="Explore a reproducible control-test sample"
    >
      <div className="lab-heading">
        <h3>A sample has a boundary.</h3>
        <p>
          Synthetic evidence window: <strong>April 1–June 30, 2026</strong>. The
          human population is 240 named privileged accounts. Service and
          break-glass accounts have separate full-test scopes.
        </p>
      </div>
      <label className="lab-focus" htmlFor={`${uid}-seed`}>
        Recorded selection seed
        <input
          id={`${uid}-seed`}
          type="number"
          min="0"
          max="4294967295"
          step="1"
          value={seed}
          onChange={(e) => set('sampleSeed', e.target.value)}
        />
      </label>
      {!data.valid ? (
        <p role="alert" className="course-notice">
          {data.error}
        </p>
      ) : (
        <>
          <div className="sampling-strata">
            {data.strata.map((stratum) => (
              <section key={stratum.name}>
                <h4>{stratum.name} · 8 / 80 selected</h4>
                <div
                  className="sample-grid"
                  role="img"
                  aria-label={`${stratum.name}: 80 synthetic human accounts, 8 selected, 72 unselected. Each square is one account.`}
                >
                  {stratum.population.map((id) => (
                    <span
                      key={id}
                      aria-hidden="true"
                      className={
                        stratum.selected.includes(id) ? 'is-selected' : ''
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
          <p className="lab-limit">
            Each square is one account. This example assumes 80 humans in each
            stratum; selection is always 8 from each. Filled squares are
            selected accounts, not passing results.
          </p>
          <div className="sample-scope-lanes">
            <section>
              <strong>Human sample · 24 / 240</strong>
              <p>216 humans remain untested by this selection.</p>
            </section>
            <section>
              <strong>Service accounts · 18 / 18 in scope</strong>
              <p>Test all 18 using their noninteractive paths.</p>
            </section>
            <section>
              <strong>Break-glass accounts · 7 / 7 in scope</strong>
              <p>Test all 7 emergency access paths.</p>
            </section>
          </div>
          <details>
            <summary>Inspect sample IDs and selection method</summary>
            <p>
              Stable IDs are sorted, then independently shuffled within each
              stratum with a seeded xorshift32 generator. The first eight are
              selected. The same seed and inventory reproduce the same 24 IDs.
              This is an illustrative reproducible selection, not a statistical
              estimator.
            </p>
            {data.strata.map((s) => (
              <p key={s.name}>
                <strong>{s.name}:</strong> {s.selected.join(', ')}
              </p>
            ))}
          </details>
          <fieldset className="sample-evidence-controls">
            <legend>Record illustrative evidence for one account</legend>
            <p>
              These are learner-entered observations for the stated quarter; the
              app has not executed a security test.
            </p>
            <label>
              Evidence scope
              <select
                value={group}
                onChange={(e) => set('sampleGroup', e.target.value)}
              >
                <option value="human">24 selected human accounts</option>
                <option value="service">All 18 service accounts</option>
                <option value="break-glass">All 7 break-glass accounts</option>
              </select>
            </label>
            <label>
              Account
              <select
                value={account}
                onChange={(e) => set('sampleAccount', e.target.value)}
              >
                {ids.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <div className="sample-paths">
              {evidencePaths.map((path, i) => (
                <label key={path}>
                  {criteria[i]}
                  <select
                    value={evidence[`${account}:${path}`] || 'missing'}
                    onChange={(e) =>
                      set(
                        'sampleEvidence',
                        JSON.stringify({
                          ...evidence,
                          [`${account}:${path}`]: e.target.value,
                        }),
                      )
                    }
                  >
                    {Object.entries(resultLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p>
              <strong>{account}:</strong>{' '}
              {resultLabels[accountEvidence(account, evidence)]}.
            </p>
          </fieldset>
          <div className="sample-conclusion" role="status">
            <h4>Human sample result · denominator 24</h4>
            <p>
              {totals!.pass} observed pass · {totals!.failure} observed failure
              · {totals!.missing} missing or untested · {totals!.exception}{' '}
              exceptions.
            </p>
            <p>
              These observations describe only the selected 24 accounts and
              their tested paths in April–June. They do not establish results
              for the other 216 humans. Reconcile exceptions and expand testing
              before making a population-wide claim.
            </p>
          </div>
          <details>
            <summary>
              Separate full-test results and account-status rule
            </summary>
            {[
              ['Service', data.serviceAccounts],
              ['Break-glass', data.breakGlassAccounts],
            ].map(([name, list]) => {
              const ids = list as string[],
                counts = summarizeSample(ids, evidence);
              return (
                <p key={String(name)}>
                  <strong>
                    {String(name)} · denominator {ids.length}:
                  </strong>{' '}
                  {counts.pass} observed pass, {counts.failure} observed
                  failure, {counts.missing} missing or untested,{' '}
                  {counts.exception} exceptions.
                </p>
              );
            })}
            <p>
              A recorded failure takes precedence, then an exception, then
              missing evidence. An account is an observed pass only when all
              five applicable evidence checks pass. The individual path results
              remain visible; one summary never removes a missing record.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
export function EventTimelineLab({ position, update }: Props) {
  const uid = useId().replaceAll(':', ''),
    canvas = useRef<HTMLDivElement>(null),
    [visibleRange, setVisibleRange] = useState('start of timeline'),
    inputs = position.exploration || {},
    measured = inputs.clockMeasured !== false,
    offset = String(inputs.clockOffset ?? '240'),
    uncertainty = String(inputs.clockUncertainty ?? '2'),
    data = eventTimelineModel(offset, uncertainty, measured);
  const set = (key: string, value: string | boolean) =>
    update({ exploration: { ...inputs, [key]: value } });
  const x = (seconds: number) =>
    data.valid
      ? 170 + ((seconds - data.min) / (data.max - data.min)) * 660
      : 170;
  return (
    <section
      className="course-lab event-timeline-lab"
      aria-label="Explore clock correction and uncertain event order"
    >
      <div className="lab-heading">
        <h3>Correct the clock; keep the uncertainty.</h3>
        <p>
          All events are synthetic UTC observations. Offset means{' '}
          <strong>device clock minus reference clock</strong>; corrected time
          equals raw time minus that signed offset.
        </p>
      </div>
      <div className="clock-inputs">
        <label>
          Database offset evidence
          <select
            value={measured ? 'measured' : 'unknown'}
            onChange={(e) =>
              set('clockMeasured', e.target.value === 'measured')
            }
          >
            <option value="measured">Measured signed offset</option>
            <option value="unknown">Offset unknown</option>
          </select>
        </label>
        <label>
          Database offset · signed seconds
          <input
            type="number"
            min="-600"
            max="600"
            step="1"
            value={offset}
            disabled={!measured}
            onChange={(e) => set('clockOffset', e.target.value)}
          />
        </label>
        <label>
          Database uncertainty · ± seconds
          <input
            type="number"
            min="0"
            max="120"
            step="1"
            value={uncertainty}
            disabled={!measured}
            onChange={(e) => set('clockUncertainty', e.target.value)}
          />
        </label>
      </div>
      {!data.valid ? (
        <p role="alert" className="course-notice">
          {data.error}
        </p>
      ) : (
        <>
          <p className="figure-scroll-hint">
            One shared UTC scale. Scroll sideways if needed; exact values follow
            as a table.
          </p>
          <div className="clock-position-context">
            <div>
              <strong>Visible plot position: {visibleRange}</strong>
              <span>
                Rows: {data.events.map((event) => event.label).join(' · ')}
              </span>
            </div>
            <div>
              <button
                type="button"
                onClick={() => canvas.current?.scrollBy({ left: -300 })}
                aria-controls={`${uid}-plot`}
              >
                Earlier
              </button>
              <button
                type="button"
                onClick={() => canvas.current?.scrollBy({ left: 300 })}
                aria-controls={`${uid}-plot`}
              >
                Later
              </button>
            </div>
          </div>
          <div
            id={`${uid}-plot`}
            ref={canvas}
            className="clock-canvas"
            role="region"
            tabIndex={0}
            aria-label="UTC uncertainty timeline with data table below"
            onScroll={(event) => {
              const element = event.currentTarget;
              const max = Math.max(
                1,
                element.scrollWidth - element.clientWidth,
              );
              const ratio = element.scrollLeft / max;
              setVisibleRange(
                ratio < 0.2
                  ? 'start of timeline'
                  : ratio > 0.8
                    ? 'end of timeline'
                    : `${Math.round(ratio * 100)}% across timeline`,
              );
            }}
          >
            <svg
              width="880"
              viewBox="0 0 880 330"
              role="img"
              aria-labelledby={`${uid}-title ${uid}-desc`}
            >
              <title id={`${uid}-title`}>Corrected event-time intervals</title>
              <desc id={`${uid}-desc`}>
                {data.events
                  .map((e) =>
                    e.lower === null
                      ? `${e.label}: offset unknown; position and bounds unresolved.`
                      : `${e.label}: ${utcClock(e.lower)} to ${utcClock(e.upper!)} UTC.`,
                  )
                  .join(' ')}{' '}
                A temporal order does not prove causality.
              </desc>
              {Array.from(
                { length: 6 },
                (_, i) => data.min + ((data.max - data.min) * i) / 5,
              ).map((tick, i) => (
                <g key={i}>
                  <line
                    x1={x(tick)}
                    x2={x(tick)}
                    y1="25"
                    y2="270"
                    className="clock-grid"
                  />
                  <text
                    x={x(tick)}
                    y="298"
                    textAnchor="middle"
                    className="clock-tick"
                  >
                    {utcClock(tick)}
                  </text>
                </g>
              ))}
              {data.events.map((event, i) => {
                const y = 62 + i * 84;
                return (
                  <g key={event.id}>
                    <text x="12" y={y + 4} className="clock-label">
                      {event.label}
                    </text>
                    {event.lower === null ? (
                      <>
                        <rect
                          x="170"
                          y={y - 13}
                          width="660"
                          height="26"
                          rx="5"
                          className="clock-unresolved"
                        />
                        <text
                          x="500"
                          y={y + 5}
                          textAnchor="middle"
                          className="clock-label"
                        >
                          ? offset unknown · bounds unresolved ?
                        </text>
                      </>
                    ) : (
                      <>
                        <line
                          x1={x(event.lower)}
                          x2={x(event.upper!)}
                          y1={y}
                          y2={y}
                          className="clock-interval"
                        />
                        <line
                          x1={x(event.lower)}
                          x2={x(event.lower)}
                          y1={y - 10}
                          y2={y + 10}
                          className="clock-cap"
                        />
                        <line
                          x1={x(event.upper!)}
                          x2={x(event.upper!)}
                          y1={y - 10}
                          y2={y + 10}
                          className="clock-cap"
                        />
                        <circle
                          cx={x(event.corrected!)}
                          cy={y}
                          r="4"
                          className="clock-center"
                        />
                        <text
                          x={Math.max(260, Math.min(730, x(event.corrected!)))}
                          y={y + 30}
                          textAnchor="middle"
                          className="clock-value"
                        >
                          {utcClock(event.lower)}–{utcClock(event.upper!)} UTC
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="lab-limit">
            Bars are uncertainty intervals, not durations. The dotted unknown
            strip is a missing time bound, not a measured interval spanning this
            axis.
          </p>
          <div
            className="clock-table-wrap"
            role="region"
            tabIndex={0}
            aria-label="Exact UTC values. Scroll horizontally if needed."
          >
            <table>
              <caption>
                Preserve raw time beside the correction · all times UTC
              </caption>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Raw time</th>
                  <th scope="col">Signed offset</th>
                  <th scope="col">Corrected interval</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e.id}>
                    <th scope="row">{e.label}</th>
                    <td>{utcClock(e.raw)}</td>
                    <td>
                      {e.offset === null
                        ? 'Unknown'
                        : `${e.offset >= 0 ? '+' : ''}${e.offset} seconds`}
                    </td>
                    <td>
                      {e.lower === null
                        ? 'Unresolved'
                        : `${utcClock(e.lower)}–${utcClock(e.upper!)} (±${e.uncertainty}s)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="clock-conclusion" role="status">
            <h4>Supported temporal precedence</h4>
            {data.precedence.length ? (
              <ul>
                {data.precedence.map((p) => (
                  <li key={p.from + p.to}>{p.label}</li>
                ))}
              </ul>
            ) : (
              <p>No pair is strictly ordered by these intervals.</p>
            )}
            {!measured ? (
              <p>
                The database event may precede, overlap, or follow the other
                events. Establish its signed offset and uncertainty before
                ordering it.
              </p>
            ) : data.precedence.length < 3 ? (
              <p>
                Overlapping or touching intervals leave at least one pair
                unresolved; the corrected center alone does not establish order.
              </p>
            ) : null}
            <p>
              Even nonoverlapping intervals establish only temporal order. They
              do not prove actor intent, data causality, complete collection, or
              custody.
            </p>
          </div>
          <details>
            <summary>Keep the evidence pipeline in scope</summary>
            <p>
              Preserve source, actor, action, object, result, correlation
              identifier, raw timestamp, correction and uncertainty together.
              Protect transport, storage and access; monitor collection health.
              Correct clocks cannot repair missing identity fields, absent
              sources or altered records.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
