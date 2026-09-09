# AI Study Assistant

Mobile-first AI study assistant built as a MERN-style TypeScript monorepo. Students can create a private study library, save notes, generate summaries, and generate practice quizzes.

## Stack

- React + Vite + Tailwind CSS (responsive PWA frontend)
- Node.js + Express + TypeScript API
- MongoDB + Mongoose
- Fake AI provider for free local development and tests
- Optional server-side Gemini provider for hosted inference

## Current status

Phase 1 (accounts and study library) is complete. Phase 2 summary generation is implemented, including validation, caching, and long-material map/reduce. Phase 3 quiz generation is in progress; quiz attempts, scoring, and practice history are next.

## Quick start

Requirements: Node.js 20+, npm, and a MongoDB instance (local or Atlas).

```powershell
npm install
Copy-Item .env.example .env
# Edit .env with your MongoDB URI and long random token secrets.
npm run dev
```

The web app runs at <http://localhost:5173> and the API at <http://localhost:4000>.

Useful commands:

```powershell
npm run lint
npm run typecheck
npm test
npm run format:check
```

## Environment and security

`.env` is local-only and ignored by Git. Never commit MongoDB credentials, Gemini keys, or token secrets. Use `.env.example` as the safe template. Keep `GEMINI_API_KEY` on the API server; it must never be added to frontend code.

The default configuration uses `AI_PROVIDER=fake`, so development and tests do not require a paid AI account. Set `AI_PROVIDER=hosted`, `HOSTED_AI_MODEL`, and `GEMINI_API_KEY` only when hosted generation is intentionally enabled.

## Documentation

Detailed product, UX, architecture, data-model, API, AI-runtime, and delivery plans are in [`doc/`](./doc/README.md). The single progress tracker is [`doc/roadmap.md`](./doc/roadmap.md).

## License

Not yet licensed. Add a license before distributing the project publicly.
