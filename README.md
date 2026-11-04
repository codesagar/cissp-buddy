# CISSP Buddy

[Open the live course](https://codesagar.github.io/cissp-buddy/#/today) · [Pilot practice](https://codesagar.github.io/cissp-buddy/pilot/#/practice)

A single-learner visual CISSP course. React + TypeScript + plain Vite; static GitHub Pages hosting; browser-local progress with export/import. Accounts and cloud synchronization are deferred.

Use Node 24.15.0. From `web/`:

```sh
npm ci
npm run dev
npm run qa:final
```

See [web/README.md](web/README.md) for learning, backup, build, and hosting instructions, [PRODUCT.md](PRODUCT.md) for product boundaries, and [the static release record](planning/static-migration/RELEASE.md) for current acceptance and deployment status.

Keep `knowledge/` beside `web/`: it supplies deterministic generation. Publish only `web/dist/`. Reference PDFs, local learner backups, credentials, databases, and caches are excluded.
