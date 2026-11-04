# Personal cloud MVP execution

Release date: November 4, 2026. Scope: one owner learner, Google sign-in, Firebase Spark without linked billing, static React/TypeScript/Vite on GitHub Pages. Guest keys and backups remain compatible. No custom backend, Functions, roles, billing/subscriptions, custom domain, or conflict engine.

| Task | Owner | Status | Acceptance evidence / unresolved issue |
|---|---|---|---|
| Protect original repositories and publication history | Main | Complete | Original workspaces and recovery snapshot retained; separate publication checkout; ordinary commits and merge; old static tag retained |
| Compare providers and settle scope | Research worker + main | Complete | provider-comparison.md; Firebase selected; single-owner/free-tier boundaries retained |
| Record conversion, hydration, saves and adoption | Records worker | Accepted | 8 pure conversion tests; 800-attempt hydration; 450-write atomic limit; 149-record import chunks; exact-source resumability; original snapshots/IDs retained |
| Account UI, main course and pilot | UI worker | Accepted | Explicit guest adoption; shared/session and remembered-device behavior; corrupt recovery preserved; sign-in guard; native browser checks below |
| Private rules and emulator test runner | Rules worker | Accepted | Owner UID/path/default-deny enforcement; immutable evidence; all 913 answer options across 303 checks; 19 isolated emulator tests pass |
| Dependencies, static packaging and CI | Main | Accepted | Lazy Firebase SDK; no Analytics; public-config validation; Node24.15.0 and Java21; npmci plus cloud/static checks on push/PR; only dist uploaded |
| Real owner setup | Owner + main | Complete | Google provider and authorized domains verified; Standard default database us-central1 Production mode; Spark no-cost; owner published reviewed rules |
| Independent review | Fresh reviewer | Resolved | Corrupt recovery overwrite, cleared pilot-note resurrection, and missing PR trigger fixed/rechecked; final small UI/doc changes reviewed; no outstanding blocking/high findings |
| Clean checkout and automated gates | Main + GitHub Actions | Pass | 82 normal tests plus separate 19 cloud tests; deterministic generation, types, lint, coverage, 744 render states, five lab models, root/subpath build and strict static HTTP inventory |
| Native browser acceptance | Main | Sampled pass | Synthetic Incognito course/pilot, reload, cross-origin restore, sign-out/nonowner isolation, mobile400px, keyboard focus, offline/reconnect; bounded evidence below |
| Pages release and live smoke | Main | Deployed and verified | b8757532fe4842abc0fdfc48109ae16c14893ca9; Actions41884413046 succeeded; live main, lazy lesson and pilot verified |
| Real learner migration | Owner | Normal first-use step | No production history was uploaded or replaced by QA. Export live guest progress, sign in there, explicitly copy browser progress; pilot adoption is separate |

## Deployment receipt

- Live course: https://codesagar.github.io/cissp-buddy/#/today
- Live pilot: https://codesagar.github.io/cissp-buddy/pilot/#/practice
- Public source/default branch: https://github.com/codesagar/cissp-buddy/tree/codex/static-pages
- Release commit: b8757532fe4842abc0fdfc48109ae16c14893ca9 (ordinary merge of reviewed personal-cloud branch).
- Validation-only run: https://github.com/codesagar/cissp-buddy/actions/runs/41884160521 (success; deployment deliberately skipped).
- Release run: https://github.com/codesagar/cissp-buddy/actions/runs/41884413046 (build and deploy success).
- Live HTTP: main HTML200, pilot HTML200, manifest200; live public config has project cissp-buddy, approved owner UID, emulators:false.
- Immutable content remains cissp-course-2026-09-94377842923795be:90units,8domains,11cases,5labs,698explained concepts,303checks directly assessing448distinct concepts. No curriculum/question identity changed.
- Final local/static receipts live under ignored web/outputs; clean verification worktree used npmci without reference PDFs, prior learning state, or a prepared database. GitHub repeated installation/validation on the exact release tree.

## Security and browser evidence

Owner UID: oJhawRwICcZYOHqRBGqUz4Ljo9G2. The rendered rule hash is bf5a8bd5138bca1ccfe2486b5a5e910a862f39a66422885f02bac3c92d7d44b4. Independent review proved the rendered file differs from the reviewed template only at that owner assignment, with the sentinel guard retained. The root template intentionally remains deny-all; the owner-specific file is generated offline and was published by the owner.

Firebase Console's active Rules revision (Today12:02PM) showed the approved UID. A real unauthenticated GET of owner main state returned403PERMISSION_DENIED. Native Google sign-in and owner reads succeeded and presented an explicit uninitialized course choice. The agent did not select Startfresh, adopt history, submit answers, or otherwise write production learning records.

Native Chrome Incognito with local demo Auth/Firestore emulators:

- Owner initialized a synthetic course; wrong ethics prediction showed its precise repair; repair opened relevant explanation step2; correct transfer followed. Review showed2distinct questions and1mistake-related response. Separate server attempt count was2.
- Explanatory note, submitted prediction/feedback, stage and review need survived reload. Review did not erase the earlier mistake after a correct changed case.
- Pilot was separately initialized. An unfinished selected answer and active quiz survived reload, then submitted feedback worked. Timer checkpoints can lag by up to15seconds.
- Sign-out removed account data from the rendered view. Another synthetic identity was rejected without loading owner learning data.
- An ordinary static server at5190/qa served a built demo-only QA output without API/SPA fallback. A different origin restored the same owner answers, note, due review and resume position from cloud. This ignored emulator build was never uploaded to Pages.
- At400CSSpx, sampled account controls, mobile menu, curriculum search (risk→22units), readable layout and desktop review keyboard focus worked. Focused desktop/mobile screenshots are in native tool receipts; screenshots were not published.
- Built online flow showed0console messages during inspection. Deliberate DevTools Offline produced expected network errors and the visible Offline—account save is pending state, retaining the edited note and pausing ordinary sign-out. Reconnection confirmed the save; the changed note survived reload. Throttling was restored afterward.
- Actual live main, deep-linked ethics lesson and pilot practice were inspected in the isolated profile. Google sign-in controls appeared. Live config was real-project/non-emulator. No real account migration or learning answer was performed during live smoke.

## Recovery, dependencies and limits

Guest keys cissp-buddy:course:v1 and cissp-buddy:v1 remain untouched by account adoption. Guest combined/pilot imports retain validation and explicit replacement. Initialized cloud history is not replaced by local imports. Damaged UID recovery copies remain until explicit validated replacement. Shared-device account state stays in memory; remembered-device recovery copies remain after sign-out and are not secure erasure. Full offline reload is not promised.

Current production npm audit:0findings. Full audit:16moderate,0high/critical, confined to Firebase CLI tooling paths (archive/glob/minimatch, UUID, Google Cloud/PubSub/OpenTelemetry). These are not shipped browser runtime; CLI hosting/archive/PubSub services are not used by the application. Trusted project/CI inputs and loopback-only demo emulators reduce applicability but do not remove advisories. A scoped grpc-js1.14.7override fixed the retained transport high finding. No forced major upgrades or billing changes were used. Reaudit current dependencies during updates; counts are not permanent release criteria.

Automated loss/quota/corrupt-import, staged adoption, immutable evidence and cleared-note reload tests complement sampled browser QA. This was not exhaustive visual/accessibility testing. A physical reboot, real second-device owner migration, human subject-expert review, and educational effectiveness were not tested. Actual owner adoption remains a first-use choice, not an agent QA operation. Historical delivery reports remain unchanged.

## Current learning refinement — shipped

Baseline:1854b75; branch:codex/learning-refinement. Real-device owner migration is explicitly deferred by the owner and is not a release blocker for this refinement. Preserve all identity/storage/curriculum formats and free-tier constraints.

| Task | Owner | Status | Acceptance / unresolved issue |
|---|---|---|---|
| Latest-check evidence selector and panel | learning_evidence | Accepted | Later wrong/assisted evidence supersedes old success; exact unit/check scope; no mastery claim; useful next action and focused tests |
| Compact everyday account UI | compact_account | Accepted | Identity/status remain visible; keyboard disclosure; recovery/setup/errors stay prominent; no Auth/store behavior changes |
| Concrete UX/content/dependency inspection | refinement_risks | Complete | Bounded findings; no speculative redesign or forced upgrades |
| Practice queue/actions and integration | refinement_risks + main | Accepted | Preserve due-date order; avoid calling answered prediction fresh; accurate future-review empty copy; meaningful rendered regression checks |
| Independent review and stable integrated QA | Fresh reviewer + main | Passed | No unresolved high/blocking findings; full retained gates and actual isolated browser sampling |
| Publication and release receipt | Main | Deployed and verified | Validated Pages artifact; no production learner data changed |

Refinement acceptance: independent reviewer passed 28 focused tests and actual wrong-prediction→correct-retry scheduling reproductions. Fixed both the legacy-scope consistency issue and an immediate-repair loop after a successful changed retry. Parent qa:final passed all ten stages on the corrected logic; 105 normal tests plus 19 isolated cloud tests pass. CSS-only final mobile adjustment and singular copy do not alter state semantics; CI repeats full checks before publication.

Main browser receipts: ordinary built static server5192/refinement, Chrome Incognito, synthetic15-response backup restored through native file chooser and explicit validated replacement. Today correctly displayed12/270 unassisted,2/270 incorrect/assisted/uncertain,256/270 unanswered;15responses remain14distinct checks. Keyboard Space toggled account options. Synthetic owner sign-in offered explicit guest-copy; adoption and reload preserved counts. Practice displayed earlier-due unit2 before unit1 and exhausted domain1 linked toreview.400CSSpx mobile account summary retained identity/status without large headline typography. Native Offline expanded warnings and disabled sign-out; reconnect confirmed the edited note and returned tocompact; reload preserved it. Online Console showed0messages before deliberate offline errors. Focused screenshot receipts remain in native tool output, not publication artifacts. No production learner data was read for test fixtures or changed.

Bundle receipt: all ten packaged-content/static checks pass; production JS contains zero of90unit titles from the generated manifest, confirming unused manifest fields were removed while the source hash constant stayed bound. Only small connection metadata is compiled; lesson bodies and pilot remain separately packaged/lazy. Curriculum release and all generated teaching JSON remain unchanged.

Maintenance: current runtime audit0findings; full audit14moderate/0highcritical, all affected paths under firebase-tools. No forced upgrades, new runtime dependencies or paid services. CI lint now includes the new evidence/Practice and existing account components. Content sampling(ethics,riskmanagement,recoverystrategies,oneconnection) found no concrete contradiction; this is not human-expert endorsement and did not justify changing immutable content.

Bounded existing limitation: a shape-valid imported response reusing a current checkID with incompatible snapshot scope is excluded from current counts; the existing assessment renderer still preserves its historical snapshot rather than silently replacing it. This is not a generated content-release path(the loader binds IDs to semantics). No automatic regrading/migration was added. Physical real-device continuity remains owner-deferred and does not block this refinement.


Refinement release receipt (November 4, 2026):

- Application commit: `65519a6a4ec8180f50e50d35cae535c62b2d6976`, ordinary merge of reviewed `codex/learning-refinement` (`ebe73da`).
- Validation-only run: https://github.com/codesagar/cissp-buddy/actions/runs/41892134516 — passed; deployment skipped by branch guard.
- Release run: https://github.com/codesagar/cissp-buddy/actions/runs/41892469239 — build and Pages deployment passed, including fresh npmci, 105 normal tests and 19 cloud tests, all ten qa:final stages, and exact publication-output verification.
- Live native Chrome smoke in an isolated Incognito profile confirmed Today’s latest evidence (new learner:0/270 unassisted,0/270 incorrect/assisted/uncertain,270/270 unanswered), compact guest account controls, and Practice’s reasoned current-check links. Live HTML and all three entry/preload scripts returned200 and included the new evidence/account code. No real sign-in or learning submission was performed for this smoke.
- Production curriculum and learner data formats did not change. Runtime dependencies and lockfile did not change. Real-device continuity is explicitly deferred by the owner, not treated as a blocker.
- Release tag: `cissp-buddy-learning-refinement-2026-11-04`. Source/default branch remains `codex/static-pages`. Temporary demo emulators/static QA server were stopped after acceptance; the normal dev preview remains available.

## Minimal UI refinement — shipped

Baseline:d029cad; branch:codex/minimal-ui. User explicitly requests a modern, minimal, space-efficient interface. Three independent source audits agree on repeated framing, duplicate healthy-save surfaces, oversized editorial hierarchy, overlapping Practice actions, and stacked teaching controls. Main observed the live Today page confirming these repetitions.

Product decisions: task-first Today with one primary start/resume action; no repeated journey primer or domain grid; one healthy account/save control in the utility bar; attention/recovery stays prominent. System typography and a 4/8/12/16/24/32 spacing scale; 16px lesson prose and readable diagrams;44px primary targets. Practice uses one due queue, optional domain practice, and a flat/disclosed learning summary. Lesson stage/feedback/scenario remain clear; playback detail and notes use progressive disclosure. No curriculum, grading, scheduling, storage, Auth, dependency or Firebase changes.

| Task | Owner | Status | Acceptance / issue |
|---|---|---|---|
| Hierarchy, spatial and study audits | Three audit agents + main | Complete | Specific findings recorded in agent reports; baseline live screenshot captured |
| Page and lesson markup | ui_study_audit | Accepted | Primary task visible at390x844/1440x900; one checkpoint CTA; notes/controls reachable; existing callbacks preserved |
| Practice, evidence and account presentation | ui_hierarchy_audit | Accepted | No duplicate action lists or healthy-save indicator; keyboard access and error/recovery states preserved |
| Shared visual styling | ui_space_audit | Accepted | Restrained system typography; compact chrome; flat surfaces; no page overflow at400px; dark/focus intact |
| Integration, independent review and browser acceptance | Main + fresh reviewers | Passed | Stable full gates plus actual isolated desktop/mobile interactions; no learner data changed |
| Release and publication receipt | Main | Deployed and verified | Feature CI41901237546 and Pages41901619827 passed; native live Today/Practice/pilot smoke passed; real-device continuity remains deferred |

Independent UI reviews: source/SSR review found a premature cross-case takeaway on Today, unreachable mobile navigation through forward keyboard order, retained small teaching-prose overrides, and a wrapped-cancellation error race in the new Today loader. All were fixed and independently rechecked. Cross-case resume always uses neutral scenario text; both async callbacks guard canceled signals. Reviewer ran 43 focused checks; effect-race behavior is source-reviewed, not claimed as an executed React-effect test.

Main baseline screenshots confirmed oversized repeated framing. Native390x844 checks show the Start action above the fold, one header/account control, keyboard Enter→Today→Tab Curriculum→Tab Practice, Escape restoring the opener, and working account-menu Escape. Actual lesson/recovery/dark/zoom acceptance is complete. No production progress is used for these checks; a copied Pages artifact and demo-project local static output are isolated on new ports.


Minimal UI acceptance (November 4, 2026): main independently exercised the built static output on isolated port5195 with synthetic demo Auth/Firestore only. Native Chrome sampling covered Start, curriculum search (ethics returns one unit), lesson reveal, wrong prediction and repair, correct transfer, review, notes including clearing/reload, explicit guest-copy adoption, pending/offline save and reconnect, cross-case neutral resume, dark appearance, reduced motion, mobile menu/account keyboard focus,390x844 and1440x900 layouts, and actual200% zoom reflow. Reviews now uses the intended system typography; teaching facts remain readable. The healthy mobile header is60px; recovery expands when required. No production learner progress was changed. Screenshot receipts remain in native tool output, outside publication artifacts.

Final stable qa:final passed all ten gates:121 normal tests plus19 cloud tests run separately, typecheck, lint, deterministic generation, all-model renderer, source-bound coverage, and strict static inventory/HTTP checks at root and project subpath. Both outputs contain90units,11connections,303checks and448directly assessed concepts; curriculum identity remains unchanged. Fresh utility and correctness reviewers rechecked their findings; none remains blocking/high. The wrapped-cancellation guard is source reviewed; no executed React-effect race test is claimed. Browser sampling is not exhaustive visual/accessibility certification, human educational review, or a real-device continuity check. Real-device continuity remains owner-deferred. No dependency, lockfile, learner schema, Firebase rule or generated JSON changes.


Minimal UI release receipt (November 4, 2026):

- Reviewed implementation: `6c1fec289194e62d363822a8d69aa1b20df195a7`; ordinary release merge: `0d7de4964b10523d64c45cea4c3e2b35d83816b9`.
- Feature validation: https://github.com/codesagar/cissp-buddy/actions/runs/41901237546 — passed; deployment correctly skipped.
- Release validation and Pages deployment: https://github.com/codesagar/cissp-buddy/actions/runs/41901619827 — passed with fresh npmci,121 normal tests and19 cloud tests, all ten final gates, production build and exact publication-output verification.
- Live: https://codesagar.github.io/cissp-buddy/#/today . Native Chrome Incognito confirmed the task-first Today with actual unit title, one Start action and compact account control; Practice showed the correct empty-review state and optional domain disclosure. Pilot practice loaded with its session control. Live HTML, all three entry/preload scripts and both stylesheets returned200; pilot returned200. Live smoke submitted no answers and signed into no real account. All consequential learning/recovery QA used synthetic data at an isolated local origin.
- Tag: `cissp-buddy-minimal-ui-2026-11-04`. Temporary5194/5195static servers and demo emulators stopped; normal dev preview retained. Original working repositories and ancestry remain preserved.
- Limits: actual browser sampling supplements exhaustive automated content inventory; no exhaustive visual/a11y certification or human-expert educational validation is claimed. Owner real-device continuity remains deferred.
