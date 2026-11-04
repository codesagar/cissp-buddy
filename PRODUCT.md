# CISSP Buddy

<!-- impeccable:product-schema 1 -->

## Platform

web

## Record Scope and Decision Precedence

This record describes the single-learner static MVP. Historical pilot proposals and delivery reports remain evidence of earlier stages, not current release acceptance.

- `planning/refined-proposal.md` establishes the product purpose, core workflows, and pilot boundaries.
- `planning/design-v3/learning-design-decisions.md` records the September 6 learning-model decisions. These supersede earlier proposals for a separate assessment at every concept node and remain requirements for future implementation.
- `web/README.md`, `web/docs/content-system.md`, and the implementation under `web/` describe the current course. Historical delivery reports retain their original validation and deployment limits.
- `planning/design-v3/focused-review.md` records prototype refinements through September 7 and their remaining validation limits. Prototype review does not establish production readiness.

## Users

CISSP learners who need to understand security concepts, connect related ideas, apply distinctions in scenarios, and revisit weaknesses. The product supports individual study in short, resumable sessions.

This is a single-learner application. Progress stays in the current browser and origin. Accounts, Firebase Authentication, Firestore, cloud synchronization, roles, and administrative features are deferred. Export/import is the supported bridge between browsers, devices, and addresses.

## Product Purpose

Provide a connected study journey: understand a concept, explore its relationships, apply it in a scenario, inspect the explanation, and return to material needing review.

Success means useful navigation, understandable and accurate teaching, dependable saved progress, and evidence that clearly describes what the learner has actually done. Lesson visits, graph coverage, and results from a small question bank do not establish exam readiness or mastery.

## Positioning

The product combines visual explanations, a connected curriculum map, scenario practice, and an explainable review queue around one shared concept library. The map is a learning and navigation tool, not a separate content silo. Content quality and meaningful connections take priority over lesson volume.

## Operating Context

- The main course connects Today, Curriculum, Practice & review, Connections, and Saved progress & preferences through hash navigation. The original ten-lesson experience remains a separate static `/pilot/` entry.
- React, TypeScript, and plain Vite produce static files for GitHub Pages. There is no application server, runtime database, or server API. The build needs sibling `knowledge/` authoring inputs; reference PDFs in `resources/` are excluded.
- Keep the established visual teaching system and components. Desktop and mobile use the same learning model. Short resumable sessions are a product intention, not a measured learning outcome.
- A loaded lesson can remain usable during a brief connection loss. Full offline reload support is not promised. Content failures must leave learner data untouched and offer retry/recovery.

## Capabilities and Constraints

### Main course and preserved pilot

- The canonical course contains eight domains and 90 units, 11 cross-domain connection cases, and five native input-driven labs. Every unit provides Understand → Predict → Transfer → Review.
- Explanation coverage includes 698 distinct concepts across 892 unit/concept occurrences. Direct assessment is narrower: 303 checks assess 448 distinct concepts. A unit result does not establish evidence for every concept in that unit.
- Today offers saved-position resume, due reviews, and a curriculum-order recommendation with a stated reason. Prerequisite exposure means a prior visit, not proof of understanding.
- Keep unit visits, correct unassisted answers to named checks, assisted answers, uncertainty, repeated exposure, review needs, unanswered checks, and concepts without directly scoped checks distinct. Do not infer mastery, exam readiness, or unseen-scenario performance.
- Preserve mistake/assistance scheduling and changed-case retry behavior. Mistakes, guesses, and assisted answers remain due; successful reviews use the existing bounded schedule. These intervals are transparent product rules, not validated mastery criteria.
- Preserve `cissp-buddy:course:v1`, `cissp-buddy:v1`, existing pilot backups, and combined backups. Retain question snapshots, semantic IDs, assistance/uncertainty flags, notes, dates, saved stages/steps/variants/exploration, and unfinished pilot quizzes.
- Invalid stored data remains available for untouched-record export until an explicitly selected valid replacement. Storage failures must be visible; in-memory work can be exported when persistent storage is unavailable.
- Shared teaching content is deterministic generated JSON, packaged as a small manifest and release-specific lazy unit/case files. The pilot curriculum loads only on its own page. Published question semantics and release identities are immutable.

### Deferred scope and evidence limits

Accounts, multi-user support, Firebase, synchronization, roles, administration, an editorial console, adaptive-learning engines, simulated CAT, pass probabilities, open-ended chat, social features, and a new curriculum or redesign are outside this MVP. Human learner testing and subject-expert review remain outstanding. AI and browser QA do not establish educational effectiveness.

## Brand Commitments

The product name is CISSP Buddy. Teaching uses plain-language explanations, realistic examples, meaningful diagrams, and explicit misconceptions or comparisons. Progress and review language must describe evidence honestly.

The main course retains its established light and dark themes, saved preferences, semantic styling, visible focus, and reduced-motion controls. Preserve the teaching design while correcting concrete usability defects.

Historical planning documents named in this record remain in the original production workspace. The minimal publication checkout includes only the selected review fixtures required by current checks; historical delivery reports are preserved locally.

## Evidence on Hand

- `web/lib/data/` contains original authoring records; `web/docs/content-system.md` describes content validation, release integrity, and the expansion workflow.
- `planning/refined-proposal.md` records product boundaries and acceptance checks; `planning/design-v3/` records the later learning-model decisions and prototype review evidence.
- Reference PDFs are held in `resources/`. They are not website assets and must not be included in publication or treated as permission to reproduce proprietary question banks.
- Content is described as AI source-checked, not independently expert-reviewed or official ISC2 training. Model review must not be relabeled as expert review.
- Prototype walkthroughs and automated implementation checks have bounded coverage. They do not prove comprehensive accessibility, production behavior, educational effectiveness, or exam readiness. Do not invent learner results, testimonials, or validation claims.

## Product Principles

1. Keep exploration, explanation, practice, and review connected through shared content and stable identifiers.
2. Prioritize accurate teaching and defensible questions over curriculum volume; record sources and review status honestly.
3. Separate activity from assessment evidence and repeated exposure from unseen-scenario performance.
4. Preserve learner orientation, saved work, and access to explanations across navigation and review.
5. Expand through coherent, validated learning units without implying coverage or effectiveness beyond the evidence.
6. Keep maintenance simple for a beginner: understandable React/TypeScript, ordinary functions, static deployment, and minimal dependencies. Use local persistence and ordinary last-write-wins behavior. Do not add speculative abstractions, conflict resolution, event sourcing, queues, microservices, a state-management framework, or an adaptive-learning engine without a concrete authorized product need.

## Accessibility & Inclusion

Support keyboard navigation, visible focus, accessible contrast, reduced motion, and text or icon equivalents for color. Provide equivalent concept navigation through the outline. Distinguish keyboard focus, selection, and review states.

Keep labels readable without requiring a zoomed-out graph. Mobile must support learning and exploration as a coherent flow rather than a reduced desktop canvas. Do not impose timed cutoffs that penalize slower reading or explanation review. Comprehensive keyboard and narrow-viewport verification remains necessary where the prototype reviews explicitly leave it open.
