# Personal cloud MVP execution

Constraints: one owner learner; Google sign-in; free tier with no billing linkage; existing GitHub Pages hostname; managed services, no custom application server/Edge/Cloud Functions. Preserve source curriculum, local progress, backups and accepted last-write-wins behavior.

| Task | Owner | Status | Evidence / remaining issue |
|---|---|---|---|
| Protect published baseline and planning | Main | Complete | Live307490b retained; local codex/personal-cloud branch; scope note checkpoint17dc87d; no push/deploy |
| Firebase versus Supabase comparison | Fresh research agent + main | Complete; decision pending | provider-comparison.md; both viable, SQL/reporting versus SDK/offline/setup/pause tradeoffs explicit |
| Pure state record conversion | Records worker | Complete groundwork | records.ts plus6 focused tests; no SDK/cloud store module |
| Account status UI | UI worker | Complete groundwork | account-controls component/CSS plus4 focused tests; no entry integration/provider imports |
| Provider-specific rules/storage | Rules worker | Paused | Firebase-specific work stopped pending provider decision; do not discard useful work |
| SDK/package integration | Main | Paused | No Firebase SDK/tool packages installed; Java21 local emulator prerequisite installed before reconsideration |
| Owner setup walkthrough | Main | Await provider decision | Earlier Firebase Project ID question is superseded for now; no cloud resource/billing configured by agent |
| Integrated security/recovery/browser acceptance | Main + future fresh review | Not started | Requires chosen provider implementation; current component/helper tests are not account-security acceptance |

The product itself is not paused or canceled: provider-neutral development continues. Provider-specific integration and provisioning wait for the comparison decision. No generic multi-provider framework will be introduced to avoid making that decision.

Main verification: full current suite69/69 passes after the neutral groundwork. Provider-specific identity/data/security flows are not implemented or accepted yet. Neither provider SDK has been installed; no cloud project or billing settings have been changed by the agent.
