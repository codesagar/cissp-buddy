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
import type { LeadVisual } from '@/lib/curriculum';
export function ConceptVisual({
  id,
  visual,
}: {
  id: string;
  visual: LeadVisual;
}) {
  if (id === 'access-models') return <AccessModelVisual visual={visual} />;
  if (id === 'risk') return <RiskVisual visual={visual} />;
  if (id === 'authentication')
    return (
      <figure className="concept-visual">
        <figcaption>{visual.title}</figcaption>
        <div className="factor-grid">
          {visual.steps!.map((step, index) => {
            const Icon = [KeyRound, Fingerprint, ScanFace][index];
            return (
              <div key={step.title}>
                <Icon size={30} />
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </div>
            );
          })}
        </div>
        <p className="visual-caption">{visual.caption}</p>
      </figure>
    );
  const s = visual;
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
        {s.steps!.map((step, i) => {
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
function AccessModelVisual({ visual }: { visual: LeadVisual }) {
  const [model, setModel] = useState('RBAC');
  const models = visual.models!;
  const m = models[model];
  return (
    <figure className="concept-visual interactive">
      <div className="visual-heading">
        <figcaption>{visual.title}</figcaption>
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
        {m.reason} {visual.caption}
      </p>
    </figure>
  );
}
function RiskVisual({ visual }: { visual: LeadVisual }) {
  const [likelihood, setLikelihood] = useState(2),
    [impact, setImpact] = useState(3);
  const score = likelihood * impact;
  return (
    <figure className="concept-visual interactive">
      <div className="visual-heading">
        <figcaption>{visual.title}</figcaption>
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
          <p>{visual.prompt}</p>
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
        . {visual.caption}
      </p>
    </figure>
  );
}
