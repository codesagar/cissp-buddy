# Firebase versus Supabase for the personal CISSP Buddy MVP

Checked November 4, 2026 against current primary documentation and the existing learner-state types. Research only: no provider resources, billing, dependencies, application code, credentials, or Git state were changed by this investigator.

## Decision in one page

**Both can meet the core requirement:** Google identity plus private, cloud-confirmed learning history restored after reload, reboot or sign-in on another device, with the React/Vite app and curriculum staying on GitHub Pages. Neither requires us to operate an application server, buy a domain, add an ORM, or use Cloud/Edge Functions for basic persistence.

**Supabase is a reasonable candidate, rather than an inherently better or worse choice.** It offers a standard Postgres database, inspectable tables, SQL queries and JSONB for existing state/snapshots. The important free-tier tradeoff is automatic inactivity pausing. Firestore's advantages here are simpler Google-provider setup and a first-party offline cache/write mechanism; those advantages matter more if preserving unsynced offline work across restarts is a requirement.

Engineering recommendation:

- If the priority is **the fewest setup steps and SDK-managed offline continuation**, retain Firebase Auth + Firestore Spark.
- If the priority is **SQL visibility, conventional data ownership/reporting, and a relational foundation**, Supabase Free is a good fit **provided the owner accepts occasional Dashboard resume after inactivity**. Treat the first release as online cloud saves plus recoverable local work; do not add a new offline-sync framework.
- For the actual stated requirement—survival of **acknowledged cloud saves**, not guaranteed offline sync—Supabase is viable. Before changing provider, make the pausing tradeoff explicit. No sunk-cost reason requires Firebase: provider-specific work was paused early.

| Concern | Firebase Auth + Firestore Spark | Supabase Auth + Postgres Free |
|---|---|---|
| Existing static host | Browser SDK; keep Pages and hash navigation | Browser SDK/Data API; keep Pages and hash navigation |
| Google identity | Enable Google in the Firebase project; SDK handles the provider flow | Create/configure Google OAuth web client ID + secret, then store them in Supabase provider settings |
| Private owner history | Security Rules bind path UID and the approved owner UID | RLS binds `auth.uid()` to row `user_id` and the approved owner UUID; grants and policies both matter |
| State shape | JSON documents; split growing attempts from positions/metadata because of document limits | SQL tables with typed ownership/query columns and JSONB state/snapshot fields; existing pure reducers can remain |
| Answer + review consistency | Small atomic SDK write batch across related documents | Small transactional SQL RPC can atomically insert attempt/update position/review; database logic lives in migrations, not a separate server |
| Server-confirmed reboot/second-device restore | Supported by loading own cloud records after Auth restoration | Supported by loading own cloud rows after Auth restoration |
| Offline writes | First-party Firestore cache/pending writes; persistent web cache opt-in on trusted devices | Do not assume `supabase-js` supplies a Firestore-equivalent durable offline write cache; preserve local work and show retry/unsynced state |
| Analysis/history querying | Queries/indexes and client-derived summaries; no relational joins | SQL joins/aggregation and standard indexes are a stronger fit for later evidence reports |
| Free operational caveat | Document/read/write/storage quotas; no week-idle pausing policy was found in reviewed Spark docs (not an uptime guarantee) | Low database activity over a seven-day window can pause the project; Dashboard resume is required |
| Stable local test environment | Firebase CLI + Auth/Firestore emulators + Java 21+ for modern CLI | Supabase CLI + a Docker-compatible runtime for the standard local stack; optional experimental native runtime is not the default recommendation |
| Minimum frontend dependency | Modular `firebase` imports | `@supabase/supabase-js`; no Prisma/Drizzle required |
| Exit path | JSON exports plus adapter/schema migration to another database | Standard Postgres/SQL dumps plus JSON exports; Auth/provider configuration still needs migration |

The table combines provider facts cited below with engineering judgments; it is not a benchmark or implementation proof.

## Free tier and intermittent study: the material difference

Current Supabase pricing lists $0/month, two active free projects, 500 MB database space, 50,000 monthly active users, 5 GB egress, and 1 GB object storage. We do not need object storage or paid add-ons for this app. These are a dated planning snapshot, not permanent release criteria. Create the project in an explicitly **Free organization**: plans apply at organization level, and projects inside a paid organization inherit that plan. Free quota excess can result in service restrictions; do not upgrade or add a card automatically. [Pricing](https://supabase.com/pricing), [billing FAQ](https://supabase.com/docs/guides/platform/billing-faq).

Supabase's current dedicated pausing documentation says Free projects with insufficient database activity over seven days may be paused, including some lightly used projects. It describes notification emails and owner Dashboard resume. Its current restore window is **one year after pausing**, restoring data/configuration; this differs from older advice quoting 90 days. A paid plan avoids inactivity pausing, but paid plans are outside this MVP. We should not introduce keep-alive cron jobs or another service to work around the free-plan policy. A paused cloud project means account/save services can be unavailable; it does not mean a browser reboot deleted the learning history. A cached/local view must not claim a fresh cloud save. [Current project-pausing policy](https://supabase.com/docs/guides/platform/free-project-pausing).

Firebase documents Spark as requiring no payment information, with social authentication and no-cost Firestore quotas. Linking Cloud Billing upgrades the project to Blaze, so do not link it or start a paid trial. Firestore's current free allowances include 1 GiB storage, 50,000 document reads/day and 20,000 writes/day; each document is limited to 1 MiB. Quota failures must preserve local recovery and show sync failure. The reviewed Firebase documents do not advertise Supabase-style week-idle pausing, but neither provider is being represented as an always-available free service. [Firebase plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Firestore limits](https://firebase.google.com/docs/firestore/quotas).

Both can serve one learner within their free allowances with sensible saving. That is a workload judgment, not a measured zero-cost guarantee. Public curriculum remains static on Pages, rather than consuming database storage/reads. Never mirror the pilot's one-second timer into cloud writes.

## Google OAuth and GitHub Pages

### Supabase

Supabase's Google setup requires a Google Cloud project, basic identity scopes, a Web OAuth client, and its client ID and **client secret saved in Supabase's Google-provider settings**. The secret is not a browser setting. The Google JavaScript origin is `https://codesagar.github.io` (paths are not origins). Google's redirect URI is the exact Supabase callback shown in the provider Dashboard, normally `https://PROJECT.supabase.co/auth/v1/callback`. Our app's post-login destination is configured separately in Supabase Site URL/redirect allowlists. No Gmail/Drive access is needed. [Google provider instructions](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

For this static hash-routed app, prefer a browser PKCE flow returning to a **real existing document URL**, such as `https://codesagar.github.io/cissp-buddy/?code=…`. Handle the code/session before the application interprets the hash route, remove auth parameters, then restore a validated saved `#/…` location. A server-side `/auth/callback` API route is unnecessary: `supabase-js` documents automatic client-side code exchange. Do not copy a Next.js server callback example into this Vite app. Avoid token-bearing implicit-flow fragments colliding with the existing hash router. The callback must finish on the browser/device that initiated PKCE, because it holds the verifier. This is a proposed integration design requiring a real browser test. [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

### Firebase

Enable Google through Firebase Authentication and use its SDK. Firebase manages the project's Google integration; manually constructing a separate OAuth web client is not usually necessary. Firebase's troubleshooting guide describes manual client construction as a rare case. Authorize the existing site hostname; retain the generated Firebase auth helper domain. On Pages, use popup sign-in first and handle cancellation/blocking. Firebase's redirect flow can require same-origin helper hosting/proxy changes in browsers blocking third-party storage; Pages cannot supply an arbitrary reverse proxy. This does not make Google sign-in impossible, but it is a concrete popup/mobile acceptance requirement. [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [Firebase Auth FAQ](https://firebase.google.com/docs/auth/faq-and-troubleshooting), [redirect constraints](https://firebase.google.com/docs/auth/web/redirect-best-practices).

A custom domain is not required for either basic path and remains deferred. Both share the existing `codesagar.github.io` browser origin with sibling project sites; UID-prefixed local keys prevent accidental mixing, not access by another script already running on that same origin.

## Privacy and data integrity

For Supabase, enable RLS on **every exposed learner table**, remove unneeded anonymous grants, and create authenticated SELECT/INSERT/UPDATE/DELETE policies with matching ownership checks. UPDATE must check both the existing and resulting owner. For this personal MVP, additionally restrict access to the configured owner UUID; allowing every authenticated Google account is too broad. Views must preserve underlying RLS (for example, `security_invoker` where supported). A public publishable key alone is not user authorization. Supabase's current docs recommend publishable keys rather than the legacy `anon` key; secret/legacy `service_role` keys bypass RLS and must never enter Vite, Pages, client config or public source. [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [key types](https://supabase.com/docs/guides/getting-started/api-keys).

Firestore must similarly deny unsigned-in users and every UID except the approved owner, enforce path ownership, validate shapes and prevent rewriting submitted answer/snapshot fields. Neither approach automatically makes private data safe just because the user signed in. Access policies are the enforcement boundary, while component-level guards prevent accidental stale displays and uploads. [Firestore ownership rules](https://firebase.google.com/docs/firestore/security/rules-conditions).

For a normalized Supabase design, one small **SECURITY INVOKER** database function can save an answer, its check reference and review together as a transaction, with normal RLS and restricted EXECUTE grants. This is managed Postgres logic checked into migrations; it does not require an Edge Function, custom application API, or another running server. It does add SQL code/tests to maintain. Multiple independent browser HTTP calls must not be described as atomic. Firestore provides the corresponding small batched write directly in its SDK. [Supabase database functions](https://supabase.com/docs/guides/database/functions), [Firestore batches](https://firebase.google.com/docs/firestore/manage-data/transactions).

Keep mutable position/note/preferences updates last-write-wins, as accepted. Keep answer snapshots/IDs/flags immutable, with the existing pilot `explanationMs` timing-only update exception. Do not make “all attempts in one JSON blob overwritten by every tick” the shortcut for either provider. Client-written practice evidence is not server-certified grading, regardless of database choice.

## Durability versus offline behavior

Once the server acknowledges a valid save, both options can load it on a fresh device after Google sign-in. Session persistence and record durability are separate: losing a token/cache may require signing in again without deleting cloud records. Supabase sessions use access/refresh tokens; configure storage and restore handling deliberately rather than interpreting an initial missing session as an empty learner account. [Supabase sessions](https://supabase.com/docs/guides/auth/sessions).

Firestore has a documented offline read/write cache that later synchronizes changes and uses last-write-wins for repeated document changes. Persistent web caching is disabled by default, requires a trusted-device choice, is not automatically cleared between sessions, and has browser limitations. This is a real dependency/implementation advantage if unsynced work must survive restart. [Firestore offline data](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

No Firestore-equivalent durable offline write mechanism was established for the standard Supabase JS client in this research. Supabase's own comparison describes adding an offline strategy. For this MVP, retain the app's local recovery/export and honest online-save status; do not add Legend-State, Electric, WatermelonDB, a custom queue or a new sync framework. Realtime notifications are not an offline database. Full offline page reload is not currently promised by either proposed integration. [Supabase's stated offline boundary](https://supabase.com/alternatives/supabase-vs-firebase).

## Reuse and development impact

The existing `LearnerState`/`StudyState`, reducers, validation, scheduler, snapshots and backup formats remain usable with either provider. They already contain positions, notes, lab inputs, answer flags and pilot quiz state. Supabase JSONB can retain those payloads while ownership, dataset, unit/check/attempt IDs and timestamps remain ordinary indexed columns. Postgres then enables later latest-response/denominator queries without a new “strength score” service. Do not migrate the public curriculum into the learner database. [Supabase JSONB support](https://supabase.com/docs/guides/database/json).

| Work | Firebase-specific implementation | Supabase-specific implementation |
|---|---|---|
| Browser identity | Firebase Auth observer/popup/persistence | Supabase auth state/session observer + PKCE startup handling |
| Data access | Firestore document mapping and bounded loads/batches | SQL schema/migrations, Data API calls and a small transactional RPC where needed |
| Authorization | Checked-in owner-only Security Rules and emulator tests | Checked-in owner-only grants/RLS/constraints and SQL/API tests |
| Frontend package | `firebase` modular imports | `@supabase/supabase-js` |
| Local testing | CLI emulators; modern Firebase CLI requires Java 21+ | Standard CLI local stack requires a Docker-compatible runtime; newer native-stack commands exist experimentally. Hosted development can start without Docker but is not a substitute for repeatable isolated policy tests |
| Validation work shared by both | Account/guest isolation, hydration-before-autosave, late-response cancellation, scoped evidence, backup adoption, save acknowledgement, recovery | Same |

Main-thread local inspection found Supabase CLI 2.62.5 already installed, no Docker-compatible `docker` executable or `psql` on PATH, and Java 21 installed during Firebase emulator preparation before the pivot. Do not upgrade the existing CLI or install a container runtime merely for this comparison. Docker is a local-stack/testing dependency, **not** a dependency for using hosted Supabase from the browser or deploying Pages. A free hosted project can support initial integration once the owner creates it, but policy tests must still be run safely before release.

The provider toolchain requirements come from the [Firebase CLI Java breaking change](https://github.com/firebase/firebase-tools/releases/tag/v15.0.0) and [Supabase local development guide](https://supabase.com/docs/guides/local-development). Pin tested versions rather than installing an unbounded latest stack. Do not add a provider-agnostic framework merely to hedge this decision.

## Backups, import and deletion

Keep existing learner JSON export/import regardless of provider. Supabase recommends free-plan users make their own database exports; downloadable managed daily backups are a paid-plan feature. Postgres SQL dumps improve portability, but they are not the same thing as restoring this app's combined learner backup. An interrupted multi-batch import needs a non-ready marker/staging contract in either system. [Supabase backups](https://supabase.com/docs/guides/platform/backups).

For owner-operated cleanup, Supabase's Dashboard can manage Auth users, and correctly declared foreign keys with `ON DELETE CASCADE` can remove linked learner rows. Configure/test the relationships rather than assuming all custom rows disappear. Firestore parent deletion does not remove subcollections, so its owner cleanup must enumerate/remove private record collections as well as the Auth identity. No paid automatic deletion service is proposed. [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data), [Firestore deletion](https://firebase.google.com/docs/firestore/manage-data/delete-data).

## What requires the owner's intervention

| Step | Firebase | Supabase |
|---|---|---|
| Account/project | Sign in to owning Google account; create/authorize an unbilled Spark project; choose Firestore region | Sign in to Supabase; choose a Free organization; create a project and choose region/database password; keep that password private |
| Google provider | Approve support/app identity and normal Google consent; agent can configure provider after authorization | Create/authorize Google Cloud OAuth setup; approve basic identity scopes/branding; put client ID and secret directly into Supabase provider settings, not chat/browser source |
| Public client values | Firebase project/web config and approved owner UID | Supabase project URL, publishable key and approved Auth UUID |
| Callback setup | Authorize `codesagar.github.io`; generated Firebase helper; local dev allowlist where needed | Configure exact Google→Supabase callback, Supabase Site URL/allowed app-return URLs, and local dev URLs |
| Access policy | Approve own UID; agent writes/deploys deny-by-default rules | Approve own UUID; agent writes migrations/RLS and tests all private tables |
| Real test | Normal Google login/MFA on own devices | Same; plus cold PKCE return/session restoration |
| After a long break | Recover normal auth/network/quota failure | May also need Dashboard Resume project; retain backup and notice the pausing email |
| Billing/domain | No billing linkage or custom domain | No paid organization/add-ons or custom domain |

The agent can author adapters, schema/rules, policy tests, startup/session UI, local recovery and Pages integration before live provider configuration. No private credentials should be pasted into chat or committed. Google brand/verification requirements depend on the actual configuration and are not waived by this proposal.

## Acceptance gates and unresolved points

Before provider-specific production work resumes:

1. Choose whether Supabase's documented free inactivity pausing is acceptable. Do not assume frequent page visits alone guarantee enough database activity, and do not add keep-alive automation.
2. If selecting Supabase, keep the first release online-sync focused; explicitly distinguish acknowledged cloud saves from unsynced local work. Do not claim automatic offline synchronization without implementing/testing it.
3. Prove browser PKCE login/return on the real Pages project URL before building the rest of a Supabase auth UX. The app must consume auth parameters before hash navigation and never expose auth tokens as a learning route.
4. Test owner allowed; signed-out and different Google-account identity cannot read/list/insert/update/delete learning records, reassign ownership, or call a privileged RPC. A policy-filtered empty result is not automatically an “empty own account” initialization signal.
5. Prove one answer/review/reference save is atomic; repeat retries preserve original IDs. Prove pilot clock ticks do not cause one cloud write per second.
6. Preserve both dataset formats and guest records; test own-account restore on a second device, stale callbacks after sign-out, corrupted/partial cloud data, quota/network failures, and interrupted adoption.
7. Choose a region before creation; moving later requires an explicit migration rather than editing a dropdown. Retain backup/export and owner-only cleanup for the MVP. [Supabase regions](https://supabase.com/docs/guides/platform/regions), [Firestore locations](https://firebase.google.com/docs/firestore/locations).

Unverified by this research: no live Firebase or Supabase prototype, actual OAuth consent screen, account-specific signup restrictions, Safari behavior, restore timing, workload cost, or performance was measured. Current docs show a usable free tier for each; the exact account-creation UI/card prompts must be checked during setup. A payment prompt is a stop-and-review condition under the owner's no-billing constraint, not permission to upgrade.
