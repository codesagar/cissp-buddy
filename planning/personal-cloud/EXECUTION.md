# Personal cloud MVP execution

Constraints: one owner learner; Google sign-in; Firebase Spark with no billing linkage; existing GitHub Pages hostname; managed Auth/Firestore only, no custom server, Cloud Functions, roles, or conflict engine. Preserve curriculum, guest keys, backups, and ordinary last-write-wins behavior.

| Task | Owner | Status | Acceptance evidence / unresolved issue |
|---|---|---|---|
| Protect original repositories and published baseline | Main | Complete | Separate publication checkout; live307490b retained; local codex/personal-cloud; recovery retained; no cloud branch deployment |
| Firebase versus Supabase comparison | Research worker + main | Complete | provider-comparison.md; owner selected Firebase |
| Record conversion, cloud hydration/save/adoption | Records worker | Implemented; independent review resolved | 8 pure record tests; paged800-attempt hydration;450-write atomic limit;149-record adoption chunks; immutable snapshots; exact-source recovery |
| Account UI/course/pilot integration | UI worker | Accepted with sampled browser checks | Shared/session versus remembered device; explicit adoption; no cloud calls in setup mode; corrupt recovery preservation; sign-in duplicate guard |
| Owner-only rules and isolated test runner | Rules worker | Implemented; independent review resolved | Parent independently reran19 emulator rules/store tests:19pass; all913 options across303 checks; otherUID/anonymous denied; default template deny-all |
| SDK/build/publication integration | Main | Implemented | Firebase13.2.0; CLI15.34.2; Java21; SDK lazy-loaded; no Analytics; PR/push cloud gate; personal-cloud deployment excluded; static public config validation |
| Owner setup | Owner + main | Complete | Projectcissp-buddy; Google enabled; localhost/codesagar.github.io verified; Standard(default) us-central1 Production database; Spark no-cost confirmed. Owner sign-in verified; UID configured and rendered rules independently checked. Owner published rules; live owner read succeeds; anonymous read returns403 |
| Independent security/recovery review | Fresh reviewer | Findings fixed and rechecked | Corrupt UIDcache overwrite and pilot note resurrection fixed;22pure tests independently passed; PR trigger gap fixed; publication inventory122files with0prohibited artifacts; final reviewer9targeted tests+root static verifier passed |
| Integrated static/model/content gates | Main | Complete automated gate | Final qa:final passed10stages after UI/config changes: generation,types,lint,tests,744renderstates,coverage,root/subpathbuilds+strictHTTP; final receipt web/outputs/static-qa/validation.json |
| Native browser account/recovery acceptance | Main | Sampled acceptance complete | Native Chrome Incognito and demo emulators: course prediction/repair/transfer/note/reload; pilot draft answer/reload/check; sign-out and nonowner isolation. Separate built static subpath restores cloud state across origins;400px mobile layout/search/menu/focus sampled. Screenshots captured in tool receipts. Automated loss/quota/corrupt-import cases complement this sampling |
| Production rules, live migration and release | Main + owner | Deployment pending | Current live site remains static baseline; do not initialize fresh local cloud data before adopting intended live browser history |

## Current safety boundaries

Real public SDK configuration has enabled:true, ownerUid:oJhawRwICcZYOHqRBGqUz4Ljo9G2, emulators:false. First owner Google sign-in was verified. Previously empty owner UID permitted Authentication setup only, without learning reads/writes. Owner-specific rules are published (Console active revision Today12:02 PM, correct UID shown; owner read succeeds and anonymous read is403); no learning upload was performed. Unauthenticated real Firestore request returned403. No production learning record was created/modified during QA. Root firestore.rules intentionally denies everyone until rendered for the owner; rendering is offline and does not deploy. Owner must complete normal Google account/consent steps. The setup preview is http://localhost:5177/#/backup.

Existing browser history belongs to its origin. Export live progress before adopting it. Main/pilot adoption are explicit and separate. Never select Start fresh on a new local origin as a substitute for carrying existing live history. Populated cloud account replacement is deliberately unsupported in this MVP.

## Dependency assessment (2026-11-04)

Current npm audit --omit=dev:0findings. Full audit:16moderate,0high/critical; remaining paths are Firebase CLI tooling (archive/glob/minimatch, UUID, Google Cloud/PubSub/OpenTelemetry dependencies), not shipped browser runtime. The application does not run CLI hosting/archive/PubSub services or use Functions. CLI runs only trusted local project/CI inputs; emulator endpoints bindloopback and use demo-projects. This reduces applicability but does not remove advisories. No forced major-version fixes or billing upgrade was applied. A scoped grpc-js1.14.7override removed the retained Firestore transport high finding; lockfile pins it. Current JSON receipts are ignored web/outputs/firebase-runtime-audit.json and firebase-development-audit.json. Reaudit when updating CLI rather than freeze these counts as release criteria.

## Acceptance limits

No claim of educational effectiveness or human expert review. Exhaustive automated content/model inventory is separate from sampled browser interaction. Real Google sign-in and exact owner rendering are verified. Production owner read and rules publication are accepted; native account UX and synthetic cross-origin cloud restore are sampled and accepted. A physical device reboot was not performed. Live release smoke and actual owner migration remain separate. Historical static delivery reports are unchanged. Implementation is checkpointed on codex/personal-cloud; release branch promotion follows the remaining deployment gate.

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

Owner rendering independent review: exact template substitution only; SHA256 bf5a8bd5138bca1ccfe2486b5a5e910a862f39a66422885f02bac3c92d7d44b4. No rule deployment performed. Owner published the rules and production authorization was checked.

Clean publication verification: separate codex/cloud-verification worktree at4897ff1 installed with npmci and passed all10qa:final stages. No reference PDFs, prior learner progress, or manually prepared database required. Exact /cissp-buddy/ static output also verified (122files,121HTTPrequests). Receipts: ignored web/outputs/firebase-setup/clean-install.log and clean-validation.log.

Clean checkout cloud gate:19/19 synthetic emulator tests passed independently of the original node_modules tree (clean-cloud-tests.log); emulators shut down normally. Owner published production rules separately; the agent did not deploy rules or write production progress.

## Main-thread browser and production receipts (2026-11-04)

- Firebase Console active Rules revision Today12:02 PM shows the approved ownerUID and sentinel guard. Spark no-cost remains selected. Live unauthenticated GET of owner main state returns403PERMISSION_DENIED. Native Google sign-in succeeds and complete owner reads return the explicit uninitialized account choice. No initial adoption, Startfresh, or learning answer was submitted to production.
- Development emulator origin5188 in Chrome Incognito: synthetic owner initialized, wrong ethics prediction submitted, targeted repair opened at relevant step2, correct transfer submitted,2distinct/1mistake evidence shown; note saved and restored after reload. Emulator admin receipts show1then2 separatecourseattempts, not overwrite.
- Pilot synthetic state separately initialized; selected draft answer and active quiz restored after reload; submitted feedback worked; sign-out removed account view. Other synthetic identity was rejected without owner data. Timer lag remains bounded by15s checkpoints.
- Built output served by ordinary static server5190/qa with noAPI/SPA fallback, local demo config compiled only into ignored QA output. Same synthetic owner restored2answers,note,due-review andresume from a different origin. This QA build is not a publication artifact.
- Chrome responsive400px sample: account controls readable/contained, menu opens/closes, curriculum search forrisk returns22units, focus visible in desktop review. Console showed0messages during inspected built flow. DevTools flagged2possible browser improvements after navigation; no application console error was observed. This is sampling, not exhaustive visual/a11y testing.
- Account corruption, quota/storage failures, interrupted adoption, exact snapshot scope, immutable history, and clearedpilotnote reload remain covered by the independent/pure/emulator regression gates. Actual reboot and educational effectiveness were not tested.
- One small QA-found pilot sidebar storage label was corrected and independently reviewed; no learning semantics changed.
