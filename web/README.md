# CISSP Buddy

**Live course:** https://codesagar.github.io/cissp-buddy/#/today  
**Pilot:** https://codesagar.github.io/cissp-buddy/pilot/#/practice  
**Public source:** https://github.com/codesagar/cissp-buddy

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

GitHub Pages receives only `web/dist/`. The publication checkout has `.github/workflows/pages.yml` at its repository root and includes `web/`, required sibling `knowledge/`, `PRODUCT.md`, and selected validation/review fixtures. The workflow runs `npm ci`, focused checks, and the static build with a Pages base path. The site is live on GitHub Pages. See the deployment receipt in `planning/static-migration/DEPLOYMENT.json` for the verified run and browser/content checks.

Root hosting uses `/`; a project site uses `/<repository>/`. Build with Vite's `--base=/<repository>/` for that path. Assets, content, favicons, and course↔pilot links use `import.meta.env.BASE_URL`. Both `/<repository>/#/today` and `/<repository>/pilot/#/practice` are supported.

Progress belongs to the current browser and origin. The main course retains `cissp-buddy:course:v1`; the pilot retains `cissp-buddy:v1`. A different address cannot automatically read your old progress. Before moving:

1. Open **Settings & backups** at the old address and export a combined backup.
2. Open that page at the new address and select the exported file.
3. Inspect the validation result and explicitly replace the local records.

Existing pilot backups also remain supported. Invalid imports and unreadable records are preserved until validated replacement. Export untouched records for recovery when offered. Storage failures are visible; export your in-memory work before leaving if saving fails. Two localStorage keys cannot provide guaranteed atomic replacement during abrupt interruption or a persistent rollback failure.

## Evidence and content

Understand → Predict → Transfer → Review connects each explanation with named assessments and exact repair feedback. Notes, stages, figure steps/variants, lab inputs, review dates, uncertainty, assistance, and unfinished pilot quizzes are retained. Today offers resume, due reviews, and an unanswered curriculum recommendation with a reason. Prerequisite visits indicate exposure, not mastery.

Today has a compact latest-evidence summary; Practice explains the latest named unit-check responses and offers up to three reasoned actions. A later mistake or assisted response does not inherit an older success. Completed changed retries retain their scheduled review date. The review queue follows due dates, and domains with no unanswered predictions link to saved evidence. Routine sign-in/account actions are in the header’s **Account** control; expanded identity and save details remain available there. Errors, setup, and recovery stay prominent. Settings and backup tools are under **Settings & backups**.

The course explains 698 concepts across 892 unit/concept occurrences. Its 303 checks directly assess 448 distinct concepts. Visits, assisted answers, correct unassisted responses, repeated exposure, review needs, unanswered assessed material, and concepts without directly scoped checks remain distinct. No mastery or exam-readiness score is inferred.

Authoring inputs and maintenance instructions are in [the content system](docs/content-system.md). Generated content is validated and packaged as a manifest plus release-specific unit/case JSON. Lessons load individually; the pilot payload loads only on its page. Do not import `lib/data/course/release.ts` in browser code: it aggregates every lesson. Changed questions must not be silently substituted under old identities.

An already loaded lesson can remain usable through a brief connection loss. Full offline reload support is not promised. Failed content loads offer retry without altering learner data.

Optional owner-only Firebase continuity is included. Public multi-user access, roles, and administration remain deferred. The personal-cloud execution record distinguishes local acceptance from the latest verified deployment. Keep the application small and understandable for a beginner maintainer. Reference PDFs, credentials, environment files, personal progress backups, local databases/caches, and unnecessary screenshots must stay outside published source and uploaded artifacts.

AI review, automated rendering/model checks, and sampled browser interaction do not establish educational effectiveness, human-expert endorsement, official ISC2 training, or comprehensive accessibility certification. Human learner and subject-expert review remain outstanding.

## Owner-only Firebase setup

The static curriculum still works without Firebase. The application uses Firebase Google Authentication and Firestore Standard on Spark, with no billing account, custom server, Cloud Functions, or Analytics SDK. Public SDK configuration lives in `public/firebase-config.json`; it contains no administrative credential. Keep service-account keys and personal backups out of source.

For project `cissp-buddy`, enable Google sign-in, authorize `localhost` and `codesagar.github.io`, and create the default Firestore database in Production mode (`us-central1`). Do not enable billing. In the local preview, sign in only to obtain the displayed account ID while `ownerUid` is empty: setup mode cannot read or upload learning history.

From `web/`, render rules for that owner:

```sh
npm run firebase:owner -- --uid=YOUR_FIREBASE_UID
```

Restart the local dev server after this command so its staged public configuration refreshes. This updates the public owner UID and renders reviewed rules into ignored `outputs/firebase-setup/firestore.owner.rules`. It does not deploy. The committed root rule template intentionally denies everyone. Publish the rendered rules in Firebase Console → Firestore Database → Rules, or, with the owner's authenticated Firebase CLI, deploy only rules/indexes using the generated configuration:

```sh
npx firebase deploy --config outputs/firebase-setup/firebase.production.json --only firestore:rules,firestore:indexes --project cissp-buddy
```

Complete owner setup and browser acceptance before publishing the website branch. On the live address, export existing browser progress first, sign in, and explicitly choose to copy browser progress. Do not initialize an empty cloud account from a fresh local preview if the live browser contains the history you want to adopt. Course and pilot adoption are separate. Importing a backup does not replace an initialized cloud account.

Only the approved UID can access learning documents. Another Google account can authenticate but cannot read or write this owner's history. Shared-device mode uses session authentication and memory-only learning state. Remember-me mode uses persistent authentication and a UID-scoped local recovery copy; those copies remain after sign-out, so use it only on a personal device. Pending/failed saves remain visible and exportable. Damaged recovery records are retained until explicit validated replacement. Pilot timers checkpoint about every 15 seconds.

Cloud tests use synthetic records and a `demo-` project; they require Java 21 and download the official Firebase emulators:

```sh
npm run test:cloud
npm run qa:final
npm audit --omit=dev
```

The normal test command skips emulator tests; `test:cloud` is a separate required CI gate. Production runtime dependency audit currently has zero findings. Remaining moderate findings are in Firebase CLI development tooling and are tracked in `planning/personal-cloud/EXECUTION.md`; do not apply forced major-version audit fixes. Browser sign-in, emulator interaction, and real deployed synchronization are separate acceptance steps from these automated checks.

The owner-only cloud release is live at the course/pilot links above. Release commit `b875753`, [successful Pages run](https://github.com/codesagar/cissp-buddy/actions/runs/41884413046). The [execution record](../planning/personal-cloud/EXECUTION.md) records real authorization, synthetic browser/recovery checks, clean-checkout validation, and limits. QA did not upload or replace the owner’s learning history.

Latest learning refinement: application commit `65519a6`, [successful Pages run](https://github.com/codesagar/cissp-buddy/actions/runs/41892469239). Today/Practice now show latest-response evidence and reasoned actions, normal account controls are compact, and review ordering/exhausted-domain guidance are corrected. Verification includes 105 normal tests plus 19 cloud tests and isolated browser sampling. Real-device continuity remains owner-deferred.

The minimal UI refinement removes repeated onboarding prose, domain grids and healthy-status cards from the study workspace. Today leads with one start/resume action. Practice uses one review queue; learning history and optional domain choices use disclosures. Lessons retain case facts and feedback while deferring inactive playback controls until the checkpoint is resolved. The source curriculum and progress formats are unchanged.
