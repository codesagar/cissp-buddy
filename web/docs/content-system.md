# CISSP Buddy content system

The main course has eight domains, 90 canonical units, 11 connection cases, and five native labs. It explains 698 distinct concepts across 892 unit/concept occurrences. Its 303 checks directly assess 448 distinct concepts; explanation coverage and assessment coverage are different. The preserved pilot has ten lessons, 97 concepts, 30 practice scenarios, 20 supplemental diagrams, and 30 embedded unscored checks. Content is AI source-checked, not human-expert certified or official ISC2 training.

## Authoring and delivery

The application is React, TypeScript, and plain Vite. All delivery is static. There is no runtime D1 database, server API, authentication, or cloud learner synchronization.

Main-course authoring inputs are sibling `knowledge/catalog/`, canonical `knowledge/domains/**/units/` and `visuals/`, plus `web/lib/data/teaching/` and `web/lib/data/connections/`. From `web/`:

```sh
npm run course:generate
npm run content:validate
npm test
npm run course:render-check
npm run build
```

`generate-course.mjs` creates deterministic `lib/data/course/manifest.json`, unit and connection JSON, source bindings, and a test/server-side aggregate `release.ts`. Browser code must never import that aggregate: it includes every lesson. Source hashes and semantic check IDs bind the authored content. A metadata-only addition to the manifest does not change question wording or content identity.

The static build validates and packages generated content under `dist/content/course/`. The browser loads the manifest first, then individual files under its exact release directory. Connection indexes and details are separate. `/pilot/` loads its own validated curriculum payload; the main entry does not download it. URLs use Vite's `BASE_URL`, supporting root and project-subpath hosting while navigation stays in the hash.

A lesson trace: canonical unit and visual rows + authored teaching model → deterministic generator → release-bound unit JSON → static packaging → validated lazy browser loader → Understand/Predict/Transfer/Review renderer. A connection follows the same release-pinned path. JSON/status/identity failures show recovery without modifying learner data. Reload may be necessary after a deployment removes an older release; the loader must not substitute current questions under an old release identity. Offline reload support is not promised.

## Learner records and backups

Course state uses `cissp-buddy:course:v1`; pilot state uses `cissp-buddy:v1`. Both remain browser- and origin-local. An answer flows from the selected draft to `recordCourseAnswer`, which saves the original question snapshot, release, semantic ID, selected option, correctness, uncertainty and assistance flags, then updates the review schedule. Review reads that saved evidence. Saved stage, figure step/variant, lab inputs, notes, and unfinished pilot quizzes remain resumable.

Visits indicate exposure. A correct unassisted answer is evidence for that named check's scoped concepts. Assisted answers and repeated exposure are distinct. Neither unit visits nor small question counts establish mastery, exam readiness, or evidence for every concept in a unit. Today combines resume, due reviews, and a curriculum-order unanswered recommendation with an explicit prerequisite/exposure reason.

To move addresses or devices, open Saved progress at the **old address**, export a combined backup, open Saved progress at the **new address**, select that file, inspect validation, and explicitly replace the local records. A different origin cannot automatically read the old store. Original pilot backups remain supported. Invalid imports and unreadable storage do not authorize replacement; untouched-record export supports recovery. Cross-key writes cannot be guaranteed atomic if the browser is interrupted or blocks rollback; recovery messages must state any incomplete replacement truthfully.

## Editing safely

1. Edit durable authoring JSON, never hand-patch generated course output. Keep stable unit/concept IDs and declared prerequisite meanings.
2. Keep each question's scope explicit. A unit's check does not assess all its concepts. Include defensible option feedback, sources, repair targets, and a changed retry case.
3. Regenerate and inspect the generated diff. Changed assessment semantics must produce a new semantic check ID and changed content a new release identity. Never silently reuse a published identity for different questions.
4. Run current validation, rendering, tests, and static build. Check root and project-subpath URLs with an ordinary static server. Preserve original question snapshots and historical delivery evidence.
5. Use `npm run qa:final` for the current reproducible release checks. New receipts go to ignored `web/outputs/`; historical reports under `planning/visual-learning-production/` and `planning/visual-explanation-implementation/` are preserved rather than regenerated as current acceptance.

Reference PDFs under `resources/`, private learner backups, environment files, credentials, databases, caches, and local screenshots do not belong in published source or Pages artifacts. Publication includes only the authoring inputs, source, and selected sanitized review fixtures required by retained checks. Upload only the intended static `dist/` output.

Human learners and a qualified educator still need to assess usability, factual ambiguity, and learning outcomes. Automated geometry, numerical labs, source bindings, AI review, and bounded browser sampling are technical evidence with different limits.
