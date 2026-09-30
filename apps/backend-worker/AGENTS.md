# apps/backend-worker

- One Worker serves the whole app on one origin: the frontend's build (`apps/frontend/dist`) as static assets, and `apps/backend` under `/api` (`assets.run_worker_first` in `wrangler.jsonc`; `src/api-path.ts` strips the prefix, so backend routes stay `/me`, `/cards`, ...). Every other path is a file or, for the SPA's own routes, `index.html`. `build` and `deploy` build the frontend first; that build reads `VITE_GOOGLE_CLIENT_ID` from `apps/frontend/.env.local`. Locally, run `vp run backend-worker#dev` next to `vp run frontend#dev`, whose dev server proxies `/api` to it.
- Cloudflare Workers entrypoint for `apps/backend`. `src/worker.ts` wires concrete dependencies (DAO → repository → service) into `createApp` from `backend/src/app.ts` and exports the app; routes and business logic stay in `apps/backend`.
- Workers-only code lives here, never in `apps/backend`: DAOs backed by Cloudflare bindings (`src/dao/*.d1.ts`, KV, R2, ...) implementing the interfaces in `backend/src/dao/*.interface.ts`, and anything that touches `env` bindings.
- Config is `wrangler.jsonc`. After adding bindings, run `vp run backend-worker#cf-typegen` to regenerate `worker-configuration.d.ts` (untracked).
- Secrets: use `wrangler secret put`, never `.env` / commit `.dev.vars`.
- `GOOGLE_CLIENT_ID` (the OAuth client id Google ID tokens must be issued for) is required: put it in `.dev.vars` for `wrangler dev`, and `wrangler secret put GOOGLE_CLIENT_ID` for production. The worker refuses to start without it.
- D1 schema changes are new files in `migrations/` (never edit an applied one); apply with `wrangler d1 migrations apply meishi-folder --local` (or `--remote`).
- DAO tests (`src/dao/*.test.ts`) run against real local D1 / R2 through `getPlatformProxy` (`src/dao/test-env.ts`: in memory, remote bindings off, every migration applied). Workers AI has no local engine, so its DAO is tested with a stub `Ai`.
