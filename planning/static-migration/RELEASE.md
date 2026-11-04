# CISSP Buddy static MVP — accepted locally

Software release: `cissp-buddy-static-2026-11-04`. Tested application commit: `b91fa13` (subsequent sealing changes are documentation and receipts only).

**Working production preview:** http://127.0.0.1:4173/#/today  
**Pilot:** http://127.0.0.1:4173/pilot/#/practice  
**Project-path preview:** http://127.0.0.1:4174/cissp-qa/#/today

**Deployment state:** deployment-ready; not live-deployed. Neither original repository has a GitHub remote. Publication needs the exact owner/repository, visibility, and authorization to push/deploy. No public repository was invented.

## Delivered product

React, TypeScript, and plain Vite now produce ordinary static files, including a real `pilot/index.html`. Vinext, RSC tooling, Cloudflare/Sites, Wrangler/Miniflare, runtime D1/server routes, and active Drizzle infrastructure are removed. Existing teaching components, CSS, hash navigation, content semantics, saved question identities, and the pilot remain.

The first page fetches a small manifest. Unit/case JSON is lazy and pinned to that manifest's release. Loaders check status, JSON structure, IDs, release, scoped checks, and semantic question hashes. Development serves the same validated static content at root and project paths. The main page does not download lesson payloads or the pilot curriculum initially.

Today offers resume, due reviews, and a curriculum-order unanswered/prerequisite recommendation with a reason. Visits mean exposure; assisted/uncertain responses, correct unassisted named-check answers, repeats, review needs, unanswered checks, and material without a scoped check remain distinct. Failed content loads no longer create a visit.

Both storage keys and backup formats remain compatible. Original question snapshots, flags, notes, review dates, saved stages/steps/variants/lab inputs, and unfinished pilot quizzes remain local. Explicit validated export/import is the cross-device/address bridge. Damaged storage is preserved; quota/write failures have visible recovery and in-memory export. Cross-key replacement cannot guarantee atomicity during abrupt interruption or blocked rollback; the interface states that limit.

Accounts, Firebase, synchronization, roles, and administration are deferred. PRODUCT.md preserves the lasting simplicity and ordinary last-write-wins principle.

## Rechecked inventory

The course release remains `cissp-course-2026-09-94377842923795be`, source SHA-256 `94377842923795bee7cb60f60af388694cad344876cf1ad766dc88618d68ede1`.

- Eight domains, 90 canonical units, 11 connection cases, five native labs.
- 698 explained concepts / 892 unit-concept occurrences.
- 303 checks directly assess **448 distinct concepts**: 434 in unit checks and 65 in connection checks, with 51 overlapping.
- The historical 450/436 claims were incorrect for the protected source as well as the current source. Current docs/checks use the verified counts; historical delivery reports remain untouched. This migration did not rewrite the curriculum.
- A fresh reviewer compared all 101 unit/case JSON files with the protected baseline: byte-for-byte unchanged.

## Reproduce

Publication checkout: `/Users/sagar/Documents/ChatGPT/CISSP-Buddy-publication`. Keep `web/` and `knowledge/` together. Node is pinned to `24.15.0` in the root Pages workflow.

```sh
cd '/Users/sagar/Documents/ChatGPT/CISSP-Buddy-publication/web'
npm ci
npm run dev
```

For static production and full verification:

```sh
npm run build
npm run qa:final
npm start -- --port=4175
```

Open http://127.0.0.1:4175/#/today after starting that server. The existing 4173 preview can be used directly. The retained server has no API/SPA fallback: missing files return 404.

`qa:final` includes content validation, deterministic generation, TypeScript, lint, tests, render checks, source-bound coverage, root and `/cissp-qa/` production builds, and exhaustive static file/HTTP checks. Receipts are under ignored `web/outputs/static-qa/`; historical audit files are protected. `course:static-check` replaces the obsolete API-specific check. The current workflow needs no D1, reference PDFs, pre-existing learner state, local database, or manually prepared `/tmp` environment.

Deployment uses the configured Pages base path and uploads only `web/dist/`, following [Vite's Pages deployment guide](https://vite.dev/guide/static-deploy.html#github-pages) and [GitHub's custom workflow requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). The workflow is at publication-root `.github/workflows/pages.yml`.

## Acceptance evidence

[ACCEPTANCE.json](ACCEPTANCE.json) binds the tested commit, source/release, exhaustive checks, and deployable archive. [BROWSER-ACCEPTANCE.json](BROWSER-ACCEPTANCE.json) records bounded actual-browser scenarios. [EXECUTION.md](EXECUTION.md) retains ownership and disposition.

A fresh committed clone at `../CISSP-Buddy-recovery-20261104-072450/clean-install-check` installed with `npm ci` and passed every gate without resources, a database, or prior local state:

- 59/59 tests, including storage/backup, semantic identity, loader failure, static routing, and development root/subpath behavior.
- 101 models; 744 guided-state renders, 744 factual renders, 913 exact repair-option targets; no React rendering warnings.
- All 90 unit and 11 connection payloads; 303 stable checks; complete source/assessment scope binding; all 104 packaged JSON files served exactly at both bases. Each build contains 115 intended files.
- Numerical/model checks retain all nine authorization combinations, 231 denominator states, 145,321 clock-offset/uncertainty combinations, and reproducible sampling/unknown evidence behavior.
- Full and production-only dependency audits: zero findings on November 4, 2026. Vite and formatter received focused compatible fixes; the unused shadcn CLI was removed while its existing CSS utilities and MIT license were retained. Runtime and build-tool applicability were assessed separately.

Actual isolated Chromium 143 interaction covered desktop 1365×900 and narrow 390×844/320×844: start/search/empty results/history; wrong answer→repair→transfer→review/reload/notes; all five labs; assisted connection evidence; theme/reduced motion; visible keyboard focus and mobile Escape; actual existing pilot backup and unfinished quiz/selection; combined export/import on a different origin and project path; invalid/delayed imports; damaged records; persistent quota failure; missing/malformed content; connection loss and retry. Normal main/subpath journeys recorded no console errors, page exceptions, or failed requests. Deliberate faults were isolated from normal-path receipts. Screenshots remain in the original workspace under `planning/static-migration/screenshots/`; no learner backups or unnecessary screenshots are included in publication.

Fresh author-independent reviewers challenged learning/data recovery and release/spec correctness. The high development-path issue and all medium findings were fixed and rechecked. Main independently reproduced the import races, failed-fetch evidence defect, quota recovery, root/subpath address bridge, and final readable layouts. No unresolved blocking/high/medium finding remains.

## Artifact, Git and recovery

The original workspace contains the ready-to-host archive at `planning/static-migration/artifacts/cissp-buddy-static-2026-11-04.zip` (115 files, 1,100,164 bytes; SHA-256 `21e5cfbe26fb22bd4d56bd6e2f93f426b9ff9896c250bc954e2c87fa05726305`). It contains only the root-hosted static site. Pages builds its own configured project-path output.

The publication branch is `codex/static-pages`, preserving original web ancestry `0337971` through ordinary baseline/layout commits `199996c` and `c470bc1`, then implementation `b91fa13`. Both original repositories remain in place, with original Git history intact; the outer repository still has no commits. Original work was not reset, cleaned, force-pushed, or discarded. Required untracked source was protected before implementation.

Verified recovery is in `../CISSP-Buddy-recovery-20261104-072450/`: complete web source snapshot, required authoring/review inputs, original product record, complete web-history bundle, and outer unborn Git metadata, with SHA-256 receipts and recovery instructions. Slow optional cloud-object copies are explicitly marked incomplete and are not relied on; original outer loose objects remain untouched. The old node_modules cache was moved there reversibly. Publication contains no PDFs, credentials/environment files, private progress fixture, databases, caches, or unnecessary screenshots.

This is technical release acceptance with bounded browser sampling. It is not exhaustive visual/assistive-technology testing, human-expert certification, official ISC2 training, or evidence of improved learning or exam readiness. Full offline reload support is not promised.
