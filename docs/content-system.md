# CISSP Buddy content system

The release contains 97 concepts, ten lessons, twenty supplemental diagrams, thirty embedded learning checks, and thirty practice scenarios. It covers an identity/access cluster in Domain 5 with selected Domain 1 and 2 foundations. Other domains are explicitly marked as not yet included. Content is AI source-checked, not independently expert-reviewed. Neither activity nor question coverage estimates exam readiness.

## Current architecture

Authoring records live under `lib/data/`, outside React components. `lib/curriculum.ts` defines the shared types. A validated release pack is imported only by server code. The server atomically installs it into D1, then reads the immutable snapshot from D1; a React provider passes this data to the lesson, graph and practice renderers. Editing content does not require changing the renderer, but currently does require a validated deployment. There is no editing console.

D1 has domains, concepts (parent/root/domain), concept relationships, lessons, questions, question-to-subtopic joins, question-to-article-section joins, and immutable content releases. Structured lesson/diagram payloads are JSON, while IDs, hierarchy, domain filters and relationships are relational and indexed. `/api/concepts` supports parent, domain, search and pagination. `/api/questions` supports domain, exact subtopic and pagination. `/api/curriculum?release=...` resolves an immutable release. All endpoints inherit the private Site access policy.

The pilot loads one release snapshot per page visit. It can continue an already loaded lesson or quiz through a brief connection loss, but does not promise offline reloads. A database failure shows a retry state without overwriting saved progress. Before a substantially larger curriculum, replace the full snapshot provider with a small release manifest and paginated branch/lesson/question reads using these indexed records; do not ship thousands of questions in every page payload.

Learner activity remains device-local, with backup import/export. It is separate from shared curriculum records. Attempts record hint usage, content release and the original question/answer/explanation snapshot. Hints and guesses keep a topic in the review queue. Embedded knowledge checks are unscored reflections and do not inflate practice evidence. There is no cross-device learner sync.

## Authoring a coherent slice

1. Choose one ISC2 objective and a bounded group of related distinctions. Add stable IDs under the appropriate parent; give each leaf a useful explanation and primary sources. Depth serves meaning, never a target node count.
2. Add an original lesson with section text, misconception, recall prompt, takeaways and sources. Choose visuals by their teaching job: comparison, sequence, decision, layers, or timeline (the risk lesson also has a dedicated interactive matrix). Every connection needs a label and every diagram a caption explaining the distinction.
3. Add scenario questions with one defensible answer, four option explanations, decisive detail, misconception, domain/objective, exact subtopics, difficulty, tags, a non-revealing hint, and section-level learning links. Include recall/application distinctions in the unscored checks.
4. Run `npm run content:validate` and `npm test`. Review diffs for content meaning as well as structure. A security educator should review facts, distractor quality, objective mappings and misleading visuals before claims of exam-complete preparation.
5. Assign a new unique release ID in `lib/content/release-pack.ts`; never alter the payload of a published release ID. Keep old IDs/records available. Question stem, option order and answer semantics are immutable: publish a new question ID for a changed assessment, retaining the old one for history. Do not delete or reassign learner-referenced IDs without an explicit tested migration.
6. Validate local D1 seeding and API filters, then deploy the content release. Schema changes require `npm run db:generate`; inspect and retain prior migrations. Data is installed in a bounded atomic batch, not embedded in schema migrations.

Current releases are additive. A future editorial system must introduce explicit retirement/aliases and learner migration before removals. Authoring JSON is source control input; D1 is the runtime content store. Do not directly edit an immutable release row.

## Expansion sequence and gates

Complete the Domain 5 cluster first; then add coherent slices for Asset Security, Security and Risk Management, Architecture and Engineering, Network Security, Assessment and Testing, Security Operations, and Software Development Security. This is a suggested content production order, not an exam weighting claim. Reconcile against the current official ISC2 outline at each release.

Each slice must connect graph → article → visual/check → tagged scenario → review before expanding breadth. Publish a coverage inventory by objective that distinguishes reading coverage, scenario coverage and expert-reviewed coverage. Do not imply that three questions establish mastery.

For each batch: an author drafts, a second reviewer checks primary sources and visual logic, a subject expert resolves ambiguous scenarios, and automated gates check IDs, cycles, domains, links, block schemas and answer shapes. Record review provenance honestly. AI review is an additional check, never the expert-review label.

Keep v1 scope focused: no social feed, marketplace, open-ended chatbot, gamification economy, native app, or simulated adaptive exam until the five core study surfaces and the curriculum justify them.
