# CISSP Buddy

A single-learner visual CISSP course built with React, TypeScript, and plain Vite. The main course covers eight domains and 90 canonical units, with 11 connection cases and five native input-driven labs. The original ten-lesson course remains at `/pilot/`, including its saved practice.

Content release: `cissp-course-2026-09-94377842923795be`. The static migration preserves the curriculum, teaching design, semantic question IDs, and saved answer snapshots.

## Run locally

Use Node **24.15.0** (the publication workflow pins this supported Node 24 release). Keep `web/` beside the required `knowledge/` directory. From `web/`:

```sh
npm ci
npm run dev
```

Open the URL Vite prints. Begin with **Start learning**, use **Curriculum** to search, or resume your saved unit from **Today**. Hash deep links work on reload and with browser back/forward navigation.

Build and verify:

```sh
npm run content:validate
npm run typecheck
npm run lint
npm test
npm run course:render-check
npm run build
npm run qa:final
```

`qa:final` is the current static-release verification workflow. It writes new receipts under ignored `web/outputs/` and protects historical audit reports. It does not need D1, Wrangler, a local database, reference PDFs, or a manually prepared `/tmp` environment. Earlier delivery reports describe the application and evidence as they existed then.

To inspect production files, serve `dist/` with an ordinary static server. Do not use an API or SPA fallback that could conceal missing JSON or the pilot entry. Use the retained server:

```sh
npm run build
npm start -- --port=4173
```

Open **http://127.0.0.1:4173/#/today** or **http://127.0.0.1:4173/pilot/#/practice**. For a project-path preview, build with `npm run build -- --base=/my-repository/`, then run `npm start -- --base=/my-repository/ --port=4174`.

## Hosting and progress

GitHub Pages receives only `web/dist/`. The publication checkout has `.github/workflows/pages.yml` at its repository root and includes `web/`, required sibling `knowledge/`, `PRODUCT.md`, and selected validation/review fixtures. The workflow runs `npm ci`, focused checks, and the static build with a Pages base path. See the current release receipt in `planning/static-migration/` for deployment status; a prepared workflow is not a live deployment.

Root hosting uses `/`; a project site uses `/<repository>/`. Build with Vite's `--base=/<repository>/` for that path. Assets, content, favicons, and course↔pilot links use `import.meta.env.BASE_URL`. Both `/<repository>/#/today` and `/<repository>/pilot/#/practice` are supported.

Progress belongs to the current browser and origin. The main course retains `cissp-buddy:course:v1`; the pilot retains `cissp-buddy:v1`. A different address cannot automatically read your old progress. Before moving:

1. Open **Saved progress & preferences** at the old address and export a combined backup.
2. Open that page at the new address and select the exported file.
3. Inspect the validation result and explicitly replace the local records.

Existing pilot backups also remain supported. Invalid imports and unreadable records are preserved until validated replacement. Export untouched records for recovery when offered. Storage failures are visible; export your in-memory work before leaving if saving fails. Two localStorage keys cannot provide guaranteed atomic replacement during abrupt interruption or a persistent rollback failure.

## Evidence and content

Understand → Predict → Transfer → Review connects each explanation with named assessments and exact repair feedback. Notes, stages, figure steps/variants, lab inputs, review dates, uncertainty, assistance, and unfinished pilot quizzes are retained. Today offers resume, due reviews, and an unanswered curriculum recommendation with a reason. Prerequisite visits indicate exposure, not mastery.

The course explains 698 concepts across 892 unit/concept occurrences. Its 303 checks directly assess 448 distinct concepts. Visits, assisted answers, correct unassisted responses, repeated exposure, review needs, unanswered assessed material, and concepts without directly scoped checks remain distinct. No mastery or exam-readiness score is inferred.

Authoring inputs and maintenance instructions are in [the content system](docs/content-system.md). Generated content is validated and packaged as a manifest plus release-specific unit/case JSON. Lessons load individually; the pilot payload loads only on its page. Do not import `lib/data/course/release.ts` in browser code: it aggregates every lesson. Changed questions must not be silently substituted under old identities.

An already loaded lesson can remain usable through a brief connection loss. Full offline reload support is not promised. Failed content loads offer retry without altering learner data.

Accounts, Firebase Authentication, Firestore, cloud synchronization, roles, and administrative features are deferred. Keep the application small and understandable for a beginner maintainer. Reference PDFs, credentials, environment files, personal progress backups, local databases/caches, and unnecessary screenshots must stay outside published source and uploaded artifacts.

AI review, automated rendering/model checks, and sampled browser interaction do not establish educational effectiveness, human-expert endorsement, official ISC2 training, or comprehensive accessibility certification. Human learner and subject-expert review remain outstanding.
