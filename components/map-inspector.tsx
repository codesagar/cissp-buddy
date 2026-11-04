import { ArrowRight, ArrowUpRight } from 'lucide-react';
import type { ConceptNode, Domain, Lesson } from '@/lib/curriculum';
import type { StudyState } from '@/lib/study-state';

type LinkedConcept = { id: string; label: string };
type HiddenRelationship = { from: string; to: string; label?: string };

export function MapInspector({
  selected,
  domain,
  parent,
  childConcepts,
  related,
  hidden,
  visibleIds,
  practiceCount,
  lesson,
  state,
  shortTitle,
  select,
  openLesson,
  openPractice,
}: {
  selected: ConceptNode;
  domain?: Domain;
  parent?: ConceptNode;
  childConcepts: ConceptNode[];
  related: LinkedConcept[];
  hidden: HiddenRelationship[];
  visibleIds: Set<string>;
  practiceCount: number;
  lesson?: Lesson;
  state: StudyState;
  shortTitle: (id: string) => string;
  select: (id: string, open?: boolean) => void;
  openLesson: () => void;
  openPractice: () => void;
}) {
  return (
    <aside className="concept-inspector" aria-label="Selected concept">
      <div className="inspector-current" aria-live="polite">
        <p className="inspector-context">
          {domain
            ? `Domain ${String(domain.id).padStart(2, '0')} · ${domain.name}`
            : `Domain ${String(selected.domainId).padStart(2, '0')}`}
          {' · '}
          {selected.parentId ? 'Sub-concept' : 'Core concept'}
          {' · Objective '}
          {selected.objective}
        </p>
        <h2 id="selected-concept-title">{selected.title}</h2>
        <p className="inspector-summary">{selected.summary}</p>
      </div>

      <div className="button-row inspector-actions">
        <button className="button" onClick={openLesson}>
          Open learning article <ArrowUpRight size={15} />
        </button>
        {practiceCount > 0 ? (
          <button className="button outline" onClick={openPractice}>
            Practice this subtopic <ArrowRight size={15} />
          </button>
        ) : (
          <p className="inspector-practice-note">
            No directly tagged practice scenarios for this concept yet.
          </p>
        )}
      </div>

      {selected.details.map((detail, index) => (
        <section className="inspector-explanation" key={index}>
          <h3>{detail.heading}</h3>
          <p>{detail.body}</p>
        </section>
      ))}

      <section className="inspector-structure" aria-label="Concept hierarchy">
        <h3>In this structure</h3>
        {parent ? (
          <div className="structure-row">
            <span>Part of</span>
            <button onClick={() => select(parent.id)}>{parent.title}</button>
          </div>
        ) : (
          <p className="structure-note">Core concept in this domain.</p>
        )}
        {childConcepts.length > 0 && (
          <div className="structure-row structure-children">
            <span>Contains {childConcepts.length} sub-concepts</span>
            <div>
              {childConcepts.map((child) => (
                <button key={child.id} onClick={() => select(child.id)}>
                  {child.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="inspector-connections" aria-label="Related concepts">
        <h3>Connected ideas</h3>
        {related.length > 0 ? (
          related.map((item) => (
            <button
              className="inspector-link"
              key={item.id}
              onClick={() => select(item.id)}
            >
              <span>{item.label}</span>
              <strong>
                {shortTitle(item.id)} <ArrowUpRight size={13} />
              </strong>
            </button>
          ))
        ) : (
          <p className="structure-note">
            No additional connections are listed beyond this hierarchy.
          </p>
        )}
      </section>

      {hidden.length > 0 && (
        <details className="hidden-relations">
          <summary>
            {hidden.length} connections in collapsed parts of this branch
          </summary>
          <div>
            {hidden.map((edge, index) => {
              const destination = visibleIds.has(edge.to) ? edge.from : edge.to;
              return (
                <button
                  key={`${edge.from}-${edge.to}-${index}`}
                  onClick={() => select(destination)}
                >
                  <span>{shortTitle(edge.from)}</span>
                  <small>{edge.label || 'Related idea'}</small>
                  <ArrowRight size={12} />
                  <span>{shortTitle(edge.to)}</span>
                </button>
              );
            })}
          </div>
        </details>
      )}

      <details className="sources">
        <summary>Sources for this idea</summary>
        {selected.sourceUrls.map((url) => (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            {new URL(url).hostname} · Reference <ArrowUpRight size={12} />
          </a>
        ))}
      </details>

      <div className="node-evidence">
        <span className="eyebrow">PRACTICE COVERAGE</span>
        <strong>{practiceCount} linked scenarios</strong>
        <p>
          {practiceCount > 0
            ? 'Related activity helps you find practice. It does not prove mastery of every linked idea.'
            : 'This concept currently has reading coverage only.'}
        </p>
        <small>
          {state.completed.includes(selected.rootConceptId)
            ? 'Parent lesson completed'
            : 'Parent lesson available'}
          {lesson ? ` · ${lesson.minutes} min` : ''}
        </small>
      </div>
    </aside>
  );
}
