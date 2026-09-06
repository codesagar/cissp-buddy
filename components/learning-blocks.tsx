'use client';
import { useState } from 'react';
import { ArrowDown, ArrowRight, Check, Lightbulb } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import type {
  DiagramBlock,
  CheckBlock,
  LearningDesign,
} from '@/lib/curriculum';
export function Diagram({
  block,
  compact = false,
}: {
  block: DiagramBlock;
  compact?: boolean;
}) {
  return (
    <figure
      className={`structured-diagram diagram-${block.kind} ${compact ? 'compact-diagram' : ''}`}
    >
      <figcaption>{block.title}</figcaption>
      {block.kind === 'comparison' ? (
        <div className="comparison-rows">
          {block.items.map((item, i) => (
            <div key={item.id}>
              <span className="diagram-index">
                {String(i + 1).padStart(2, '0')}
              </span>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
      ) : block.kind === 'timeline' ? (
        <ol className="timeline-items">
          {block.items.map((item, i) => (
            <li key={item.id}>
              <span className="timeline-dot">{i + 1}</span>
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
              {block.links
                .filter((l) => l.from === item.id)
                .map((l, i) => (
                  <small key={i}>
                    {l.label} → {block.items.find((n) => n.id === l.to)?.label}
                  </small>
                ))}
            </li>
          ))}
        </ol>
      ) : block.kind === 'layers' ? (
        <div className="layer-items">
          {block.items.map((item, i) => (
            <div
              style={{ marginLeft: i * 12, marginRight: i * 12 }}
              key={item.id}
            >
              <span>{i + 1}</span>
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="causal-items">
          {block.items.map((item, i) => (
            <div key={item.id} className="causal-step">
              <div
                className={item.role === 'decision' ? 'policy-decision' : ''}
              >
                <span className="diagram-index">{i + 1}</span>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
              {block.links
                .filter((l) => l.from === item.id)
                .map((link, j) => (
                  <div key={j} className="causal-link">
                    <ArrowDown size={15} />
                    <span>{link.label}</span>
                    {block.items[i + 1]?.id !== link.to && (
                      <strong>
                        {block.items.find((x) => x.id === link.to)?.label}
                      </strong>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
      <p className="diagram-caption">{block.caption}</p>
      {!compact &&
        (block.kind === 'comparison' || block.kind === 'layers') &&
        block.links.length > 0 && (
          <div className="diagram-relationships" aria-label="Relationships">
            {block.links.map((l, i) => (
              <span key={i}>
                {block.items.find((x) => x.id === l.from)?.label}
                <ArrowRight size={12} />
                <em>{l.label}</em>
                <ArrowRight size={12} />
                {block.items.find((x) => x.id === l.to)?.label}
              </span>
            ))}
          </div>
        )}
    </figure>
  );
}
export function CardVisual({
  visual,
}: {
  visual: LearningDesign['cardVisual'];
}) {
  const block: DiagramBlock = {
    id: 'card',
    type: 'diagram',
    afterSection: 0,
    kind: visual.kind as DiagramBlock['kind'],
    title: visual.title,
    caption: visual.caption,
    items: visual.items,
    links: visual.connections || [],
  };
  return <Diagram block={block} compact />;
}
export function KnowledgeCheck({
  block,
  onResult,
}: {
  block: CheckBlock;
  onResult?: (correct: boolean, assisted: boolean) => void;
}) {
  const [choice, setChoice] = useState<string>(''),
    [submitted, setSubmitted] = useState(false),
    [hint, setHint] = useState(false),
    [usedHint, setUsedHint] = useState(false);
  const correct = Number(choice) === block.correctIndex;
  return (
    <section className="embedded-check">
      <div className="check-heading">
        <Lightbulb size={17} />
        <span className="eyebrow">CHECK THE CONNECTION</span>
        <span>Learning check · unscored</span>
      </div>
      <h3>{block.prompt}</h3>
      <RadioGroup
        value={choice}
        onValueChange={(v) => setChoice(String(v))}
        disabled={submitted}
        aria-label={block.prompt}
        className="embedded-options"
      >
        {block.options.map((o, i) => (
          <label
            key={i}
            htmlFor={`${block.id}-${i}`}
            className={submitted && i === block.correctIndex ? 'correct' : ''}
          >
            <RadioGroupItem id={`${block.id}-${i}`} value={String(i)} />
            <span>{o}</span>
            {submitted && i === block.correctIndex && <Check size={15} />}
          </label>
        ))}
      </RadioGroup>
      {hint && !submitted && <p className="hint-box">{block.hint}</p>}
      {submitted ? (
        <div className="embedded-feedback" aria-live="polite">
          {correct ? <Check size={18} /> : <Lightbulb size={18} />}
          <p>
            <strong>
              {correct
                ? 'Yes—keep this distinction.'
                : 'Here is the useful distinction.'}
            </strong>
            {block.explanation}
            {usedHint && <small>Hint-assisted reflection</small>}
          </p>
        </div>
      ) : (
        <div className="button-row">
          <button
            className="button outline"
            disabled={!choice}
            onClick={() => {
              setSubmitted(true);
              onResult?.(correct, usedHint);
            }}
          >
            Check my understanding <ArrowRight size={14} />
          </button>
          <button
            className="text-link"
            onClick={() => {
              setHint((v) => !v);
              setUsedHint(true);
            }}
          >
            {hint ? 'Hide hint' : 'A little hint'} <Lightbulb size={13} />
          </button>
        </div>
      )}
      {submitted && (
        <button
          className="text-link"
          onClick={() => {
            setChoice('');
            setSubmitted(false);
            setHint(false);
            setUsedHint(false);
          }}
        >
          Think it through again
        </button>
      )}
    </section>
  );
}
