# AGENTS.md

## Cursor Cloud specific instructions

PitchIntel (`world-cup-intelligence`) is a single product: a React 19 + Vite SPA served by a
Hono API running on **one** Cloudflare Worker (D1, KV, R2, Queues, Durable Object). It is not a
monorepo — all commands run from the repo root. Standard scripts live in `package.json`; the
README "Quick start" covers the happy path. Notes below are the non-obvious caveats.

### Running the app (dev)
- `npm run dev` runs **both** the React SPA **and** the Worker/API in one process on
  `http://localhost:5173` (via `@cloudflare/vite-plugin`). `/api/*` is served by the in-process
  Worker — you do **not** need a separate `wrangler dev` / `npm run dev:uat` for normal local work.
  The Vite proxy to `127.0.0.1:8787` only matters if you intentionally run a standalone worker.
- Copy `.env.example` → `.dev.vars` for Worker runtime vars. This sets `MOCK_SOURCES=true`, so no
  external APIs (FIFA/RSS/StatsBomb) or AI/OpenAI keys are needed locally. `.dev.vars` is gitignored
  and not persisted across fresh VMs — recreate it.
- The `AI` binding always talks to remote Cloudflare (a harmless warning prints on startup); the app
  degrades gracefully via `AI_FALLBACK_MODE` / `VECTORIZE_FALLBACK_MODE`, so it is fine for local dev.

### Local database (D1) — important gotcha
- The local SQLite state lives in `.wrangler/` (gitignored) and is **not** persisted across fresh
  VMs. The app shows no match data until the local D1 is migrated.
- The `npm run db:migrate:local` and `npm run seed` scripts reference the **production** DB name
  `wc-tactical-db`, but the default (UAT) binding `DB` maps to `wc-tactical-db-uat`. Migrate the DB
  the running app actually reads instead:
  ```bash
  npx wrangler d1 migrations apply wc-tactical-db-uat --local
  ```
  This applies all 32 migrations including the `0003_seed_reference.sql` seed, so a separate seed
  step is not required. Using `npx wrangler` (not the npm scripts) also avoids the
  `scripts/wrangler-with-env.mjs` wrapper, which requires `CLOUDFLARE_API_TOKEN` even for `--local`.

### Quality checks
- `npm run test` — Vitest, ~190 pure unit tests, no DB/Worker needed. This is the reliable check.
- `npm run build` — Vite build of client + Worker into `dist/`.
- `npm run lint` is **broken** on `main`: `eslint` is not in `devDependencies` and there is no ESLint
  config, so it fails with `eslint: not found`. Use `npm run typecheck` instead.
- `npm run typecheck` currently reports **pre-existing** type errors on `main` (e.g. in
  `src/ingestion/fifa/*`, `src/services/pitchMap.ts`). These are not caused by environment setup.
