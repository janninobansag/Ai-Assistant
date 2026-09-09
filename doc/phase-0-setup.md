# Phase 0 Setup Notes

Phase 0 has been implemented as a runnable foundation without requiring a hosted AI key.

## What is included

- npm workspaces for `apps/web`, `apps/api`, and `packages/shared`.
- Shared Zod schemas for summary, quiz, and API errors.
- Vite + React + Tailwind mobile shell.
- Express API with Helmet, CORS, JSON limits, and request logging.
- Environment parsing with safe development defaults.
- Deterministic fake AI provider for local development and tests.
- Liveness, readiness, and development fake-summary endpoints.
- Root scripts for dev, build, typecheck, lint, and test workspaces.

## Local setup

From the repository root:

```bash
npm install
copy .env.example .env
npm run dev
```

The web shell runs on `http://localhost:5173`; the API runs on `http://localhost:4000`.

PowerShell users can copy the environment template with:

```powershell
Copy-Item .env.example .env
```

Useful checks:

```text
GET http://localhost:4000/api/v1/health/live
GET http://localhost:4000/api/v1/health/ready
GET http://localhost:4000/api/v1/dev/fake-summary?text=Mitosis%20creates%20two%20cells
```

The API now connects to MongoDB during startup using `MONGODB_URI`. It exits with a clear error if the database cannot be reached. Authentication and library models are still deferred to Phase 1.

Atlas note: MongoDB only lists a database after a successful write. The Atlas URI should include `/ai-study-assistant` before the query string; restart the API after changing it, create a subject or material, and refresh Compass.

Current configuration check: `.env` points to the remote host `cluster0.zmoqhkn.mongodb.net`, so the application is targeting Atlas. In Compass, inspect the connection details for `Bansga`; if its host matches that hostname, `Bansga` is simply the saved connection label for the Atlas cluster. `Cluster0` may be a separate saved connection.

The API explicitly loads the repository-root `.env` even when npm runs the workspace from `apps/api`, preventing an accidental fallback to the local MongoDB default.

### Vite WebSocket warning

During development, the browser may log `WebSocket connection to ws://localhost:5173 ... Page entered Back-Forward Cache`. This is a Vite hot-module-reload connection being suspended by the browser's Back-Forward Cache, not an application or database error. Reload the page or reopen the tab; no production behavior is affected. If it persists, stop and restart `npm.cmd run dev`.

When copying an Atlas driver URI, prefer the **SRV Connection String** toggle. Put the current cluster URI in `.env` only; do not copy the real password into `.env.example`. The Atlas cluster host shown in the console is authoritative if it differs from an older saved URI.

The committed `.env.example` uses safe Atlas placeholders. Keep real credentials only in the uncommitted `.env` file. For local-only development, the URI can be changed to `mongodb://127.0.0.1:27017/ai-study-assistant`.

## Phase 0 acceptance checklist

- [x] Repository folders and npm workspaces exist.
- [x] Frontend renders a mobile-first shell.
- [x] Tailwind is configured with initial semantic colors.
- [x] API starts with `AI_PROVIDER=fake` and no AI credentials.
- [x] Shared validation contracts exist.
- [x] `.env.example` documents the required configuration.
- [x] API startup connects to MongoDB and exposes database readiness.
- [x] CI workflow runs lint, type checks, and unit tests.
- [x] Prettier formatting and CI format check are configured.
- [x] Install dependencies and run the checks locally.
- [ ] Confirm the team's Node version and package manager policy.
- [ ] Choose the production AI provider and quota values before Phase 2.

## Phase 1 starting point

Begin with `apps/api/src/modules/auth` and `apps/api/src/modules/subjects`, then replace the placeholder frontend button with the authentication and library flows described in the roadmap.
