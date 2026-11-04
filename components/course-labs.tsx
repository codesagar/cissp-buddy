'use client';
/* eslint-disable jsx-a11y/prefer-tag-over-role -- Inline SVG and count partitions expose authored image semantics; replacing them with img would discard the editable figure. */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard users must be able to focus and scroll these local figure regions; complete text equivalents follow. */
import { useId } from 'react';
import { SamplingLab, EventTimelineLab } from './course-evidence-labs';
import { authorizationModel, denominatorModel } from '@/lib/course/lab-models';
import type { PolicyFact } from '@/lib/course/lab-models';
import type { UnitPosition } from '@/lib/course/learner-state';

type Props = {
  position: UnitPosition;
  update: (patch: Partial<UnitPosition>) => void;
};
export const hasLab = (id: string) =>
  [
    'd6-o03-process-data',
    'd6-o02-control-testing',
    'd7-o02-logging-architecture-evidence',
    'd5-o04-authorization-mechanisms',
    'd3-o07-implementation-side-channel-attacks',
  ].includes(id);
export function CourseLab({ unitId, ...props }: Props & { unitId: string }) {
  if (unitId === 'd6-o02-control-testing') return <SamplingLab {...props} />;
  if (unitId === 'd7-o02-logging-architecture-evidence') return <EventTimelineLab {...props} />;
  if (unitId === 'd6-o03-process-data') return <DenominatorLab {...props} />;
  if (unitId === 'd5-o04-authorization-mechanisms')
    return <AuthorizationLab {...props} />;
  if (unitId === 'd3-o07-implementation-side-channel-attacks')
    return <SideChannelLab {...props} />;
  return null;
}
function DenominatorLab({ position, update }: Props) {
  const inputs = position.exploration || {};
  const patched = String(inputs.patched ?? '0'),
    unpatched = String(inputs.unpatched ?? '0'),
    scope = inputs.scope === 'census' ? 'census' : 'known',
    censusKnown = inputs.censusKnown !== false;
  const data = denominatorModel(patched, unpatched, scope, censusKnown);
  const set = (key: string, value: string | boolean) =>
    update({ exploration: { ...inputs, [key]: value } });
  const pct = (n: number) => `${n.toFixed(1)}%`;
  return (
    <section
      className="course-lab denominator-lab"
      aria-label="Explore the denominator"
    >
      <div className="lab-heading">
        <h3>The assets stay. The denominator changes.</h3>
        <p>
          One snapshot: 120 assets, with the same patch criterion and no
          duplicates.
        </p>
      </div>
      {data.valid && (
        <>
          <div className="population-label">
            <strong>{data.total} assets in the scenario</strong>
            <span>Shared scale: 0–120 assets</span>
          </div>
          {/* The partition is one graphic; its accessible label carries exact counts. */}
          {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
          <div
            className="population-bar"
            role="img"
            aria-label={`${data.patched} known patched, ${data.unpatched} known unpatched, ${data.unknown} unknown, total 120 assets`}
          >
            <span
              className="population-patched"
              style={{ width: `${data.patched / 1.2}%` }}
            />
            <span
              className="population-unpatched"
              style={{ width: `${data.unpatched / 1.2}%` }}
            />
            <span
              className="population-unknown"
              style={{ width: `${data.unknown / 1.2}%` }}
            />
          </div>
          <dl className="population-legend">
            <div>
              <dt>
                <i className="population-patched" />
                Known patched
              </dt>
              <dd>{data.patched} assets</dd>
            </div>
            <div>
              <dt>
                <i className="population-unpatched" />
                Known unpatched
              </dt>
              <dd>{data.unpatched} assets</dd>
            </div>
            <div>
              <dt>
                <i className="population-unknown" />
                Unknown
              </dt>
              <dd>{data.unknown} assets</dd>
            </div>
          </dl>
        </>
      )}
      <div className="lab-controls">
        <label>
          Reporting scope
          <select value={scope} onChange={(e) => set('scope', e.target.value)}>
            <option value="known">Known-status assets only</option>
            <option value="census">All 120 assets in the census</option>
          </select>
        </label>
        <label className="lab-checkbox">
          <input
            type="checkbox"
            checked={censusKnown}
            onChange={(e) => set('censusKnown', e.target.checked)}
          />
          The 120-asset census is complete
        </label>
      </div>
      <div className="evidence-inputs">
        <p>
          <strong>Discover evidence</strong> among the 20 originally unknown
          assets. A report filter alone does not change these counts.
        </p>
        <label>
          Verified patched
          <input
            type="number"
            min="0"
            max="20"
            step="1"
            value={patched}
            onChange={(e) => set('patched', e.target.value)}
            inputMode="numeric"
          />
        </label>
        <label>
          Verified unpatched
          <input
            type="number"
            min="0"
            max="20"
            step="1"
            value={unpatched}
            onChange={(e) => set('unpatched', e.target.value)}
            inputMode="numeric"
          />
        </label>
        <button
          onClick={() =>
            update({ exploration: { ...inputs, patched: '0', unpatched: '0' } })
          }
        >
          Reset evidence
        </button>
      </div>
      {!data.valid ? (
        <output className="course-notice">{data.error}</output>
      ) : (
        <>
          <output className="population-results">
            <div>
              <h4>
                {scope === 'known'
                  ? 'Known-status report'
                  : 'Verified patched in the census'}
              </h4>
              <strong>
                {data.numerator} / {data.denominator} = {pct(data.rate)}
              </strong>
              <p>
                {scope === 'known'
                  ? `${data.unknown} unknown assets excluded from this denominator.`
                  : 'Unknowns remain in the denominator. This is the verified minimum, not an exact all-asset patch rate.'}
              </p>
            </div>
            <div>
              <h4>Possible patch rate across all assets</h4>
              {censusKnown ? (
                <>
                  <strong>
                    {pct(data.lower!)} – {pct(data.upper!)}
                  </strong>
                  <p>
                    {data.unknown === 0
                      ? 'All statuses are known, so the arithmetic interval collapses to one value.'
                      : 'Lower: no unknown assets are patched. Upper: all unknown assets are patched.'}
                  </p>
                </>
              ) : (
                <>
                  <strong>Not established</strong>
                  <p>
                    An incomplete inventory leaves the fleet denominator
                    unknown. These 120 observed assets cannot bound the rate
                    across the whole fleet.
                  </p>
                </>
              )}
            </div>
          </output>
        </>
      )}
      <p className="lab-limit">
        The interval is arithmetic uncertainty, not a confidence interval or
        attack probability. Asset criticality and patch urgency still need a
        separate risk decision.
      </p>
    </section>
  );
}
function AuthorizationLab({ position, update }: Props) {
  const uid = useId().replaceAll(':', ''),
    inputs = position.exploration || {};
  const assignment = (
    ['yes', 'no', 'unknown'].includes(String(inputs.assignment))
      ? inputs.assignment
      : 'yes'
  ) as PolicyFact;
  const device = (
    ['yes', 'no', 'unknown'].includes(String(inputs.device))
      ? inputs.device
      : 'no'
  ) as PolicyFact;
  const result = authorizationModel(assignment, device);
  const set = (key: string, value: string) =>
    update({ exploration: { ...inputs, [key]: value } });
  return (
    <section
      className="course-lab authorization-lab"
      aria-label="Explore current authorization and enforcement"
    >
      <div className="lab-heading">
        <h3>A policy result must reach an enforcement point.</h3>
        <p>
          An authenticated clinician requests <strong>READ R7</strong>. This
          illustrative policy permits only an assigned clinician using a
          compliant device.
        </p>
      </div>
      <div
        className="lab-wide"
        role="region"
        aria-label="Authorization diagram with text equivalent below"
        tabIndex={0}
      >
        {/* SVG image semantics retain the authored title and description. */}
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
        <svg
          viewBox="0 0 880 420"
          role="img"
          aria-labelledby={`${uid}-title ${uid}-desc`}
        >
          <title id={`${uid}-title`}>Request, decision and enforcement</title>
          <desc id={`${uid}-desc`}>
            {result.permit
              ? 'The policy permits the request and the API enforcement point forwards it to R7.'
              : 'The policy denies the request and the API enforcement point stops it before R7.'}{' '}
            The resource remains visible; authentication is already established.
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
          </defs>
          <rect
            x="620"
            y="36"
            width="236"
            height="176"
            rx="12"
            className="lab-boundary"
          />
          <text x="738" y="61" textAnchor="middle" className="lab-small">
            Protected resource boundary
          </text>
          <path
            d="M216 124H332"
            className="lab-path"
            markerEnd={`url(#${uid}-arrow)`}
          />
          <text x="274" y="108" textAnchor="middle" className="lab-small">
            READ R7
          </text>
          {result.permit ? (
            <>
              <path
                d="M520 124H656"
                className="lab-path"
                markerEnd={`url(#${uid}-arrow)`}
              />
              <text x="589" y="108" textAnchor="middle" className="lab-small">
                permitted read
              </text>
            </>
          ) : (
            <>
              <path d="M520 124H562M562 109V139" className="lab-blocked" />
              <text x="563" y="163" textAnchor="middle" className="lab-small">
                STOP: no read
              </text>
            </>
          )}
          <path
            d="M372 176V292"
            className="lab-path"
            markerEnd={`url(#${uid}-arrow)`}
          />
          <text x="355" y="232" textAnchor="end" className="lab-small">
            current context
          </text>
          <path
            d="M480 292V176"
            className="lab-path"
            markerEnd={`url(#${uid}-arrow)`}
          />
          <text x="500" y="239" className="lab-small">
            {result.decision.toLowerCase()} result
          </text>
          <g>
            <rect
              x="28"
              y="80"
              width="188"
              height="96"
              rx="8"
              className="lab-node"
            />
            <text x="122" y="112" textAnchor="middle" className="lab-label">
              Clinician
            </text>
            <text x="122" y="142" textAnchor="middle" className="lab-small">
              identity validated
            </text>
          </g>
          <g>
            <rect
              x="332"
              y="80"
              width="188"
              height="96"
              rx="8"
              className="lab-node active"
            />
            <text x="426" y="112" textAnchor="middle" className="lab-label">
              API · PEP
            </text>
            <text x="426" y="142" textAnchor="middle" className="lab-small">
              {result.permit ? 'enforces permit' : 'enforces denial'}
            </text>
          </g>
          <g>
            <rect
              x="656"
              y="80"
              width="164"
              height="96"
              rx="8"
              className="lab-node"
            />
            <text x="738" y="112" textAnchor="middle" className="lab-label">
              Record R7
            </text>
            <text x="738" y="142" textAnchor="middle" className="lab-small">
              {result.permit ? 'read reached' : 'not reached'}
            </text>
          </g>
          <g>
            <rect
              x="332"
              y="292"
              width="188"
              height="92"
              rx="8"
              className="lab-node"
            />
            <text x="426" y="326" textAnchor="middle" className="lab-label">
              Policy · PDP
            </text>
            <text x="426" y="355" textAnchor="middle" className="lab-small">
              assigned AND compliant
            </text>
          </g>
        </svg>
      </div>
      <div className="lab-controls">
        {[
          {
            key: 'assignment',
            label: 'Currently assigned to R7',
            value: assignment,
          },
          { key: 'device', label: 'Current device compliance', value: device },
        ].map((f) => (
          <label key={f.key}>
            {f.label}
            <select
              value={f.value}
              onChange={(e) => set(f.key, e.target.value)}
            >
              <option value="yes">Yes, supported by current evidence</option>
              <option value="no">No</option>
              <option value="unknown">Evidence unknown / missing</option>
            </select>
          </label>
        ))}
      </div>
      <output
        className={`authorization-result ${result.permit ? 'permit' : 'deny'}`}
      >
        <strong>{result.decision} at the API enforcement point.</strong>
        <p>
          {result.reason}{' '}
          {result.permit
            ? 'R7 receives the allowed operation.'
            : 'The request stops before the record. R7 does not receive this read.'}
        </p>
      </output>
      <details>
        <summary>Read the request trace as text</summary>
        <ol>
          <li>The clinician’s identity is already validated.</li>
          <li>
            The API sends the subject, READ action, R7, assignment and device
            evidence to the policy decision point.
          </li>
          <li>
            The PDP returns {result.decision.toLowerCase()} under the stated
            conjunction.
          </li>
          <li>
            The PEP{' '}
            {result.permit
              ? 'forwards the permitted read'
              : 'stops the read before R7'}
            .
          </li>
        </ol>
      </details>
      <p className="lab-limit">
        This is a conceptual transaction, not OAuth/SAML message order or a
        latency model. The diagram covers this API path; alternate paths need
        their own enforcement tests.
      </p>
    </section>
  );
}
function SideChannelLab({ position, update }: Props) {
  const uid = useId().replaceAll(':', ''),
    focus = String(position.exploration?.focus || 'remote');
  const notes: Record<
    string,
    { surface: string; question: string; defense: string }
  > = {
    remote: {
      surface: 'Timing and error behavior',
      question:
        'Can repeated requests expose secret-dependent differences under this network and noise model?',
      defense:
        'Test timing and error behavior with realistic inputs. Constant-time techniques address relevant timing paths, not every implementation risk.',
    },
    resident: {
      surface: 'Shared-resource effects',
      question:
        'Can co-resident observation distinguish secret-dependent cache or other shared-resource activity?',
      defense:
        'Inspect sharing and isolation assumptions and measure relevant effects; do not infer a leak just because two workloads share hardware.',
    },
    physical: {
      surface: 'Power / EM and induced disturbance',
      question:
        'Which measurements or disturbances are feasible with this physical access? Observation and fault injection are different actions.',
      defense:
        'Test feasible leakage and fault paths. Fault injection may also have nonphysical forms; the access categories are not exclusive.',
    },
  };
  const note = notes[focus] || notes.remote;
  return (
    <section
      className="course-lab sidechannel-lab"
      aria-label="Explore implementation observation and disturbance"
    >
      <div className="lab-heading">
        <h3>The algorithm’s boundary is not the implementation’s boundary.</h3>
        <p>
          Intended input/output, outward observation and inward disturbance are
          different paths.
        </p>
      </div>
      <div
        className="lab-wide"
        role="region"
        aria-label="Side-channel path diagram with complete text equivalent below"
        tabIndex={0}
      >
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
        <svg
          viewBox="0 0 880 460"
          role="img"
          aria-labelledby={`${uid}-title ${uid}-desc`}
        >
          <title id={`${uid}-title`}>
            Intended interface versus possible implementation paths
          </title>
          <desc id={`${uid}-desc`}>
            Intended input enters the computation and intended output leaves it.
            Possible timing, cache and power observations point outward.
            Possible induced disturbance points inward. No path claims a
            successful attack.
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
          </defs>
          <rect
            x="224"
            y="28"
            width="430"
            height="220"
            rx="12"
            className="lab-boundary"
          />
          <text x="439" y="56" textAnchor="middle" className="lab-small">
            Implementation boundary · conceptual execution
          </text>
          <path
            d="M26 134H276M600 134H852"
            className="lab-path"
            markerEnd={`url(#${uid}-arrow)`}
          />
          <text x="131" y="112" textAnchor="middle" className="lab-small">
            INPUT
          </text>
          <text x="754" y="112" textAnchor="middle" className="lab-small">
            OUTPUT
          </text>
          <rect
            x="276"
            y="88"
            width="324"
            height="88"
            rx="8"
            className="lab-node"
          />
          <text x="438" y="121" textAnchor="middle" className="lab-label">
            Computation + secret state
          </text>
          <text x="438" y="150" textAnchor="middle" className="lab-small">
            mathematical algorithm ≠ implementation
          </text>
          {[
            { x: 282, label: 'Timing / errors', key: 'remote' },
            { x: 438, label: 'Cache effects', key: 'resident' },
            { x: 594, label: 'Power / EM', key: 'physical' },
          ].map((item) => (
            <g
              key={item.key}
              className={focus === item.key ? 'lab-emphasis' : ''}
            >
              <path
                d={`M${item.x} 176V336`}
                className="lab-observation"
                markerEnd={`url(#${uid}-arrow)`}
              />
              <rect
                x={item.x - 46}
                y="267"
                width="92"
                height="24"
                className="lab-mask"
              />
              <text
                x={item.x}
                y="284"
                textAnchor="middle"
                className="lab-small"
              >
                OBSERVE
              </text>
              <rect
                x={item.x - 70}
                y="344"
                width="140"
                height="68"
                rx="8"
                className="lab-node"
              />
              <text
                x={item.x}
                y="385"
                textAnchor="middle"
                className="lab-small"
              >
                {item.label}
              </text>
            </g>
          ))}
          <path
            d="M50 365V208Q50 200 58 200H276"
            className="lab-observation"
            markerEnd={`url(#${uid}-arrow)`}
          />
          <text x="110" y="184" className="lab-small">
            DISTURB
          </text>
          <text x="30" y="394" className="lab-small">
            Induced fault
          </text>
        </svg>
      </div>
      <label className="lab-focus">
        Inspect an attacker model
        <select
          value={focus}
          onChange={(e) =>
            update({
              exploration: { ...position.exploration, focus: e.target.value },
            })
          }
        >
          <option value="remote">Remote observer</option>
          <option value="resident">Co-resident observer</option>
          <option value="physical">Physical access</option>
        </select>
      </label>
      <div className="sidechannel-note">
        <h4>{note.surface}</h4>
        <p>{note.question}</p>
        <p>{note.defense}</p>
      </div>
      <details>
        <summary>Read every path as text</summary>
        <ul>
          <li>INPUT → computation → OUTPUT is the intended interface.</li>
          <li>
            Computation → timing/errors, cache effects, or power/EM denotes
            possible outward observation.
          </li>
          <li>
            Induced disturbance → computation denotes an inward fault-injection
            path.
          </li>
          <li>
            Selection changes inspection focus. All paths remain visible;
            categories can overlap.
          </li>
        </ul>
      </details>
      <p className="lab-limit">
        Dashed paths are possible measurements or disturbances, not observed
        exfiltration events. Leakage and exploitability require evidence. No
        probability or quantitative scale is implied.
      </p>
    </section>
  );
}
