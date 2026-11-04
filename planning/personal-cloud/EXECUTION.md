# Personal cloud MVP execution

Constraints: one owner learner; Google sign-in; Firebase Spark with no billing linkage; existing GitHub Pages hostname; managed Auth/Firestore only, no custom server, Cloud Functions, roles, or conflict engine. Preserve curriculum, guest keys, backups, and ordinary last-write-wins behavior.

| Task | Owner | Status | Acceptance evidence / unresolved issue |
|---|---|---|---|
| Protect original repositories and published baseline | Main | Complete | Separate publication checkout; live307490b retained; local codex/personal-cloud; recovery retained; no cloud branch deployment |
| Firebase versus Supabase comparison | Research worker + main | Complete | provider-comparison.md; owner selected Firebase |
| Record conversion, cloud hydration/save/adoption | Records worker | Implemented; independent review resolved | 8 pure record tests; paged800-attempt hydration;450-write atomic limit;149-record adoption chunks; immutable snapshots; exact-source recovery |
| Account UI/course/pilot integration | UI worker | Implemented; browser acceptance pending | Shared/session versus remembered device; explicit adoption; no cloud calls in setup mode; corrupt recovery preservation; sign-in duplicate guard |
| Owner-only rules and isolated test runner | Rules worker | Implemented; independent review resolved | Parent independently reran19 emulator rules/store tests:19pass; all913 options across303 checks; otherUID/anonymous denied; default template deny-all |
| SDK/build/publication integration | Main | Implemented | Firebase13.2.0; CLI15.34.2; Java21; SDK lazy-loaded; no Analytics; PR/push cloud gate; personal-cloud deployment excluded; static public config validation |
| Owner setup | Owner + main | Partly complete | Projectcissp-buddy; Google enabled; localhost/codesagar.github.io verified; Standard(default) us-central1 Production database; Spark no-cost confirmed. Owner sign-in verified; UID configured and rendered rules independently checked. Remaining: owner rules publication |
| Independent security/recovery review | Fresh reviewer | Findings fixed and rechecked | Corrupt UIDcache overwrite and pilot note resurrection fixed;22pure tests independently passed; PR trigger gap fixed; publication inventory122files with0prohibited artifacts; final reviewer9targeted tests+root static verifier passed |
| Integrated static/model/content gates | Main | Complete automated gate | Final qa:final passed10stages after UI/config changes: generation,types,lint,tests,744renderstates,coverage,root/subpathbuilds+strictHTTP; final receipt web/outputs/static-qa/validation.json |
| Native browser account/recovery acceptance | Main | Pending | Setup page visually observed; native AX sign-in activation did not produce popup/status. Owner sign-in still required. Automated/emulator success is not browser acceptance |
| Production rules, live migration and release | Main + owner | Pending external owner UID/setup and final browser QA | Current live site remains static baseline; do not initialize fresh local cloud data before adopting intended live browser history |

## Current safety boundaries

Real public SDK configuration has enabled:true, ownerUid:oJhawRwICcZYOHqRBGqUz4Ljo9G2, emulators:false. First owner Google sign-in was verified. Previously empty owner UID permitted Authentication setup only, without learning reads/writes. Owner-specific rules are rendered locally and await publication; no learning upload was performed. Unauthenticated real Firestore request returned403. No production learning record was created/modified during QA. Root firestore.rules intentionally denies everyone until rendered for the owner; rendering is offline and does not deploy. Owner must complete normal Google account/consent steps. The setup preview is http://localhost:5177/#/backup.

Existing browser history belongs to its origin. Export live progress before adopting it. Main/pilot adoption are explicit and separate. Never select Start fresh on a new local origin as a substitute for carrying existing live history. Populated cloud account replacement is deliberately unsupported in this MVP.

## Dependency assessment (2026-11-04)

Current npm audit --omit=dev:0findings. Full audit:16moderate,0high/critical; remaining paths are Firebase CLI tooling (archive/glob/minimatch, UUID, Google Cloud/PubSub/OpenTelemetry dependencies), not shipped browser runtime. The application does not run CLI hosting/archive/PubSub services or use Functions. CLI runs only trusted local project/CI inputs; emulator endpoints bindloopback and use demo-projects. This reduces applicability but does not remove advisories. No forced major-version fixes or billing upgrade was applied. A scoped grpc-js1.14.7override removed the retained Firestore transport high finding; lockfile pins it. Current JSON receipts are ignored web/outputs/firebase-runtime-audit.json and firebase-development-audit.json. Reaudit when updating CLI rather than freeze these counts as release criteria.

## Acceptance limits

No claim of educational effectiveness or human expert review. Exhaustive automated content/model inventory is separate from sampled browser interaction. Real Google sign-in and exact owner rendering are verified. Production owner rule publication, deployed cloud restore, reboot/relogin, and account UX browser QA remain unaccepted. Historical static delivery reports are unchanged. All completed implementation stays on codex/personal-cloud until these gates close.

Final normal test receipt tail (cloud emulator cases run separately):

```text
creen renders (22.883375ms)
✔ malformed linked-case models and reference rows reject before rendering (9.355583ms)
Packaged 90 units, 11 connections and separate pilot (cissp-course-2026-09-94377842923795be).
Packaged 90 units, 11 connections and separate pilot (cissp-course-2026-09-94377842923795be).
✔ ordinary Vite development serves real packaged JSON at root and project paths (529.238958ms)
✔ ordinary static server honors directory entries, subpaths, and real missing files (87.395417ms)
✔ curriculum has complete connected teaching assets and traceable sources (1.925958ms)
✔ fresh state reports no invented progress (0.364791ms)
✔ scheduler keeps mistakes and guesses due, spaces correct answers transparently (0.113375ms)
✔ question selection diversifies concepts and prefers unseen variants (8.8605ms)
✔ answer feedback and mid-session reload preserve all evidence once (0.351458ms)
✔ unfinished answer selection can resume without submitting it (0.099375ms)
✔ repeat practice does not inflate unique evidence (0.115166ms)
✔ backup round trip restores completed lessons, notes, reviews and active quiz (0.167833ms)
✔ malformed, unknown and future backup data never validates (0.309375ms)
✔ due queue sorts overdue concepts first and sparse status stays cautious (0.135167ms)
ℹ tests 101
ℹ suites 0
ℹ pass 82
ℹ fail 0
ℹ cancelled 0
ℹ skipped 19
ℹ todo 0
ℹ duration_ms 1531.955583
npm notice run cissp-buddy@0.1.0 test
npm notice run node --experimental-strip-types --test tests/*.test.mjs

```

Owner rendering independent review: exact template substitution only; SHA256 bf5a8bd5138bca1ccfe2486b5a5e910a862f39a66422885f02bac3c92d7d44b4. No rule deployment performed. Console publication requested from owner.
