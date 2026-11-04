# CISSP Buddy

A complete visual study course built on the existing React, TypeScript, Vinext, and Cloudflare D1 application. The default route contains all eight domains and 90 canonical units. The original ten-lesson experience and its saved practice remain at `/pilot`.

## Open the verified course

The local production preview is **http://localhost:3109/#/today**.

Content release: `cissp-course-2026-09-94377842923795be`.

Start with **Start learning**, or use **Curriculum** to search a concept. Each unit offers Understand → Predict → Transfer → Review. Five units also provide an **Explore inputs** lab. Connections contains 11 bounded cross-domain cases and separately identifies 21 reference-only relationships.

See the [visual-explanation implementation delivery](../planning/visual-explanation-implementation/FINAL-DELIVERY.md) for the current repair tour, implementation ledger, browser evidence, and QA limits. The [whole-course delivery](../planning/visual-learning-production/FINAL-DELIVERY.md) retains the broader production history.

## Start or restart locally

Use Node 22.13 or newer. From `web/`, install dependencies if needed with `npm ci`.

To restart the already prepared preview:

```sh
cd '/Users/sagar/Documents/ChatGPT/CISSP Buddy/web'
./node_modules/.bin/wrangler dev --config dist/server/wrangler.json --port 3109 --persist-to /tmp/cissp-visual-review-943778-preview-v1
```

If the temporary database or build is unavailable, recreate a local production preview:

```sh
cd '/Users/sagar/Documents/ChatGPT/CISSP Buddy/web'
export CISSP_PREVIEW_STATE="$PWD/.wrangler/course-preview"
for migration in drizzle/0000_ancient_squadron_supreme.sql drizzle/0001_careful_calypso.sql drizzle/0002_flaky_winter_soldier.sql; do
  npx wrangler d1 execute DB --local --config wrangler.local.json --persist-to "$CISSP_PREVIEW_STATE" --file "$migration" --yes
done
npm run build
./node_modules/.bin/wrangler dev --config dist/server/wrangler.json --port 3109 --persist-to "$CISSP_PREVIEW_STATE"
```

The migrations are additive and include the immutable course schema; the server installs and seals the generated release. Stop an existing process on port 3109 before starting another. `npm run dev` is the development workflow; the handoff uses the production build above. No remote publication was performed.

## Content and learner evidence

The deterministic `course:generate` pipeline links canonical units, concept occurrences, objectives, and source references to authored JSON teaching models. A small course manifest and lazy per-unit API avoid downloading every question on the first page. Four shared renderer families support 101 authored models, 220 base/changed cases, and 744 guided states; these are separate from the five native input-driven labs and 79 reviewed treatment decisions.

All 698 declared concepts have reachable explanation and source context across 892 unit/concept occurrences. Assessment coverage is narrower: 303 new checks directly assess 450 distinct concepts (270 unit checks assess 436; 33 connection checks assess 65, with overlap). The 179 canonical aids remain source inventory, not a count of new interactive widgets.

The original `cissp-buddy:v1` progress key is preserved. New course state uses `cissp-buddy:course:v1`. Progress belongs to a browser and origin; export/import moves it between addresses. Combined backups carry both versions, and an original pilot backup can still be imported. Invalid or damaged records are preserved until a valid replacement is explicitly selected. Question snapshots retain original wording, answer, release, uncertainty, hint use, and viewed-outcome assistance. Mistakes or assisted answers remain due for review; no mastery or exam-readiness percentage is inferred.

## Validation and evidence

```sh
npm run content:validate
npm run typecheck
npm run lint
npm test
npm run course:render-check
npm run build
npm run course:coverage -- --expected-release=cissp-course-2026-09-94377842923795be
npm run qa:final -- --expected-release=cissp-course-2026-09-94377842923795be --port=3110
```

`qa:final` runs historical validators in an isolated copy, verifies protected source hashes, applies fresh local migrations, and tests the built API. Do not run a historical evidence-writing validator directly against preserved audit files.

Independent GPT-5.6 SOL reviewers challenged all eight domains, with root independently reviewing the integration worker's 11 connection cases. The visual-explanation rollout rechecked all 78 changed routes and the complete 744-state render set, plus desktop/narrow interaction paths for the highest-impact repairs. Historical whole-course browser evidence remains preserved; exact source and build bindings distinguish exhaustive checks from bounded readable visual inspection.

Wide diagrams scroll locally with keyboard access and complete text equivalents. Reviews are AI acceptance, not human expert endorsement, accessibility certification, official ISC2 training, or evidence of improved learning outcomes. Learner-tested treatments: **0**. Source books and exam dumps are not included in the course.
