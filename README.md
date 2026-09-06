# CISSP Buddy

A focused visual study companion built with React, TypeScript, Vinext, and the Sites starter. Three GPT-5.6 Luna subagents prepared and cross-reviewed the curriculum, instructional questions, and UX acceptance research. The owning agent integrated the app.

## MVP scope

- 10 original visual lessons: eight IAM topics plus risk and asset classification.
- Two interactive teaching diagrams: access-control model comparison and illustrative likelihood/impact matrix.
- Recursive 97-concept graph, expandable through four levels, with stable positions, search, breadcrumbs, pan/zoom, hidden relationship disclosure, leaf explanations and an equivalent outline. Five domains are explicitly outside the pilot.
- Twenty supplemental structured diagrams and thirty unscored knowledge checks embedded in lessons. Lesson cards use meaningful visual grammars and captions.
- 30 original instructional questions, each tagged with domain, objective, subtopics, hint and section-level article links, with explanations for every option. Recommended, topic, mixed, and due-review sessions use a shared engine.
- Persistent quiz resume, optional guess flags, separated answer/explanation time, and no enforced time limit. The ten-minute session duration is a target, not empirically calibrated yet.
- Spaced concept review, automatic mistake explanations, personal notes, and browser-local progress with validated JSON export/import.

## Running and validation

Node 22.13+ is required.

```sh
npm ci
npx wrangler d1 execute DB --local --config wrangler.local.json --file drizzle/0000_ancient_squadron_supreme.sql # first local setup only
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

The lint script covers authored app code, not the unmodified generated UI catalog. The starter catalog has upstream lint findings. React runtime packages were patched to 19.2.8. The original starter still has development/tooling and unused image-parser dependency advisories; there are no image-upload, image-optimization, or server-action features in this app.

## State and content

`lib/study-state.ts` holds pure selection, scheduling, evidence, and backup-validation logic. `lib/data/` contains authoring records, validated and installed atomically into D1. The server reads an immutable release from D1 into a React content provider. Indexed tables support recursive parent/domain queries and question subtopic filters. See [the content system and expansion workflow](docs/content-system.md). Every content item links to a primary reference and identifies AI source-checking honestly; none is represented as independently expert-reviewed or official ISC2 training. Source books in the parent resources folder are not included or published.

Progress is keyed by `cissp-buddy:v1` in localStorage. It is browser- and origin-specific, not synced to an account. A local-preview backup can be imported into the published site. Damaged stored data is preserved rather than silently overwritten. Imported backups replace state only after full validation and explicit confirmation.

Review rules: mistakes, guesses and hint-assisted answers are due now. A later correct answer schedules 3 days, then repeated successful reviews double the interval up to 30 days. Missing confidence stays unknown. Unique question counts exclude repeats; no pass probability or mastery score is computed.

## Verification boundaries

The automated suite covers release validation, every recursive branch/leaf, stable graph coordinates, broken reference rejection, hint evidence, content snapshots, scheduler behavior, variant selection, quiz resumption, answer/explanation timing, repeat evidence, and valid/invalid backup cases. Production compilation and TypeScript are checked. Browser interaction, visual, keyboard, and device QA have not been performed; they were not requested for this run. Delayed unseen-scenario learning evidence needs real study use and is not claimed by the MVP.

The app feature-detects imperative WebMCP and exposes `read_study_progress` and `open_study_concept` using the same UI state/actions. No supported WebMCP validation context was available in this environment; those tool contracts are not claimed to be runtime-verified. Unsupported browsers simply use the normal interface.
