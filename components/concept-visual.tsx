'use client';
import { useState } from 'react';
import {
  ArrowRight,
  Fingerprint,
  KeyRound,
  ShieldCheck,
  UserRound,
  FileCheck2,
  ScanFace,
  UserPlus,
  RefreshCw,
  UserMinus,
  Eye,
  Pencil,
  Clock3,
  Check,
  X,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
const stages: Record<
  string,
  { title: string; steps: { title: string; detail: string }[]; caption: string }
> = {
  identity: {
    title: 'Three questions. Three different jobs.',
    steps: [
      { title: 'Identify', detail: '“I am Morgan.”' },
      { title: 'Authenticate', detail: '“Here is my proof.”' },
      { title: 'Authorize', detail: '“May I read this file?”' },
    ],
    caption:
      'Naming an identity does not prove the claim. Proving the claim does not grant every permission.',
  },
  authorization: {
    title: 'A request becomes a policy decision',
    steps: [
      { title: 'Request', detail: 'Subject + resource + action' },
      { title: 'Evaluate', detail: 'Policy + current context' },
      { title: 'Enforce', detail: 'Permit or deny' },
    ],
    caption:
      'An authenticated session supplies context. The enforcement point still checks the requested action.',
  },
  federation: {
    title: 'One trusted identity, another application',
    steps: [
      { title: 'Identity provider', detail: 'Authenticates the person' },
      { title: 'Signed assertion', detail: 'Validated for this recipient' },
      { title: 'Relying party', detail: 'Creates session, checks access' },
    ],
    caption:
      'The application trusts a validated assertion—not a forwarded password. Local authorization still applies.',
  },
  'least-privilege': {
    title: 'The smallest permission that gets the job done',
    steps: [
      { title: 'Task', detail: 'Generate a sales report' },
      { title: 'Grant', detail: 'Read the reporting view' },
      { title: 'Limit', detail: 'No writes or admin rights' },
    ],
    caption:
      'A reporting task needs read access to relevant data. It does not need the ability to edit production records.',
  },
  'access-lifecycle': {
    title: 'Access follows the relationship',
    steps: [
      { title: 'Joiner', detail: 'Approve the minimum baseline' },
      { title: 'Mover', detail: 'Replace outdated permissions' },
      { title: 'Leaver', detail: 'Revoke accounts and sessions' },
    ],
    caption:
      'A transfer is a removal event as well as an addition. Otherwise, permissions accumulate.',
  },
  accountability: {
    title: 'Make the action traceable',
    steps: [
      { title: 'Unique identity', detail: 'Who performed the action?' },
      { title: 'Protected record', detail: 'What, when, where, outcome' },
      { title: 'Review', detail: 'Reconstruct and investigate' },
    ],
    caption:
      'Shared credentials weaken attribution. Logging alone does not establish who actually acted.',
  },
  classification: {
    title: 'Three lenses on the same information',
    steps: [
      { title: 'Confidentiality', detail: 'Harm from disclosure' },
      { title: 'Integrity', detail: 'Harm from alteration' },
      { title: 'Availability', detail: 'Harm from disruption' },
    ],
    caption:
      'A public website can have low confidentiality needs and high integrity or availability needs.',
  },
};
export function ConceptVisual({ id }: { id: string }) {
  if (id === 'access-models') return <AccessModelVisual />;
  if (id === 'risk') return <RiskVisual />;
  if (id === 'authentication')
    return (
      <figure className="concept-visual">
        <figcaption>Count the factors, not the steps.</figcaption>
        <div className="factor-grid">
          {[
            [KeyRound, 'Know', 'Password or PIN'],
            [Fingerprint, 'Have', 'Security key or device'],
            [ScanFace, 'Are', 'Biometric activation'],
          ].map(([Icon, title, detail]) => (
            <div key={String(title)}>
              {typeof Icon !== 'string' && <Icon size={30} />}
              <strong>Something you {String(title).toLowerCase()}</strong>
              <span>{String(detail)}</span>
            </div>
          ))}
        </div>
        <p className="visual-caption">
          <strong>Password + PIN = one factor category.</strong> A device-bound
          authenticator unlocked with a biometric can combine possession and
          inherence; biometrics are not a standalone remote authenticator.
        </p>
      </figure>
    );
  const s = stages[id] || stages.identity;
  const icons =
    id === 'access-lifecycle'
      ? [UserPlus, RefreshCw, UserMinus]
      : id === 'classification'
        ? [Eye, Pencil, Clock3]
        : [UserRound, ShieldCheck, FileCheck2];
  return (
    <figure className="concept-visual">
      <figcaption>{s.title}</figcaption>
      <div className="diagram-steps">
        {s.steps.map((step, i) => {
          const Icon = icons[i];
          return (
            <div className="step-group" key={step.title}>
              <div className="diagram-step">
                <span className="step-number">0{i + 1}</span>
                <Icon size={25} />
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </div>
              {i < 2 && <ArrowRight className="step-arrow" size={22} />}
            </div>
          );
        })}
      </div>
      <p className="visual-caption">{s.caption}</p>
    </figure>
  );
}
function AccessModelVisual() {
  const [model, setModel] = useState('RBAC');
  const models: Record<
    string,
    { policy: string; input: string; answer: string; reason: string }
  > = {
    RBAC: {
      policy: 'Only the Payroll role may edit salary records.',
      input: 'Morgan’s assigned role: Payroll',
      answer: 'Permit',
      reason: 'The permission comes from Morgan’s role.',
    },
    ABAC: {
      policy:
        'Payroll staff may edit only from a managed device during work hours.',
      input: 'Role: Payroll · Device: unmanaged · Time: 10 am',
      answer: 'Deny',
      reason: 'The role matches, but the device attribute fails the policy.',
    },
    DAC: {
      policy: 'The document owner may choose who receives edit access.',
      input: 'Owner shares the file with Morgan as an editor.',
      answer: 'Permit',
      reason: 'The owner exercises discretion to grant the permission.',
    },
    MAC: {
      policy:
        'A central policy requires the right clearance and approved need-to-know.',
      input: 'Morgan lacks the required clearance.',
      answer: 'Deny',
      reason: 'The owner cannot override the mandatory policy.',
    },
  };
  const m = models[model];
  return (
    <figure className="concept-visual interactive">
      <div className="visual-heading">
        <figcaption>Same person. Different policy.</figcaption>
        <span className="interaction-tag">TRY IT</span>
      </div>
      <Tabs value={model} onValueChange={(v) => setModel(String(v))}>
        <TabsList className="model-tabs">
          {Object.keys(models).map((k) => (
            <TabsTrigger value={k} key={k}>
              {k}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="model-scenario" aria-live="polite">
        <div>
          <span className="eyebrow">THE POLICY</span>
          <p>{m.policy}</p>
          <span className="eyebrow">THE REQUEST</span>
          <p>{m.input}</p>
        </div>
        <ArrowRight />
        <div
          className={`decision ${m.answer === 'Permit' ? 'permit' : 'deny'}`}
        >
          {m.answer === 'Permit' ? <Check size={27} /> : <X size={27} />}
          <strong>{m.answer}</strong>
        </div>
      </div>
      <p className="visual-caption">
        {m.reason} These examples isolate each model; real systems can combine
        them.
      </p>
    </figure>
  );
}
function RiskVisual() {
  const [likelihood, setLikelihood] = useState(2),
    [impact, setImpact] = useState(3);
  const score = likelihood * impact;
  return (
    <figure className="concept-visual interactive">
      <div className="visual-heading">
        <figcaption>Likelihood and impact work together.</figcaption>
        <span className="interaction-tag">TRY IT</span>
      </div>
      <div className="risk-interactive">
        <div className="risk-controls">
          <label>
            Likelihood{' '}
            <strong>{['', 'Low', 'Moderate', 'High'][likelihood]}</strong>
          </label>
          <Slider
            aria-label="Likelihood"
            value={[likelihood]}
            onValueChange={(v) => setLikelihood(Array.isArray(v) ? v[0] : v)}
            min={1}
            max={3}
            step={1}
          />
          <label>
            Impact <strong>{['', 'Low', 'Moderate', 'High'][impact]}</strong>
          </label>
          <Slider
            aria-label="Impact"
            value={[impact]}
            onValueChange={(v) => setImpact(Array.isArray(v) ? v[0] : v)}
            min={1}
            max={3}
            step={1}
          />
          <p>
            What happens if an exposed admin account controls a critical system?
          </p>
        </div>
        <div>
          <figure
            className="risk-matrix"
            aria-label={`Illustrative matrix: likelihood ${likelihood} out of 3, impact ${impact} out of 3`}
          >
            {[3, 2, 1].flatMap((l) =>
              [1, 2, 3].map((i) => (
                <span
                  key={`${l}-${i}`}
                  className={`risk-cell risk-${l * i >= 6 ? 'high' : l * i >= 3 ? 'medium' : 'low'} ${l === likelihood && i === impact ? 'selected' : ''}`}
                >
                  {l === likelihood && i === impact ? <span>●</span> : l * i}
                </span>
              )),
            )}
          </figure>
          <small>Impact → · Likelihood ↑</small>
        </div>
      </div>
      <p className="visual-caption" aria-live="polite">
        Illustrative priority:{' '}
        <strong>
          {score >= 6 ? 'higher' : score >= 3 ? 'moderate' : 'lower'}
        </strong>
        . This simple scale teaches the relationship; a real assessment also
        needs threat context, safeguards, and defined impact criteria.
      </p>
    </figure>
  );
}
