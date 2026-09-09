# AI Study Assistant — Planning Index

This folder contains the complete implementation plan for a mobile-first AI study assistant built with the MERN stack.

## Product goal

Build an installable mobile web application where students can add study material, generate summaries and quizzes, and chat with an AI tutor using the material as context.

## Agreed technology

| Layer | Technology |
| --- | --- |
| Mobile frontend | React + Vite, delivered as a responsive Progressive Web App (PWA) |
| Styling | Tailwind CSS |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Authentication | Email/password with short-lived access tokens and rotating refresh tokens |
| AI integration | Provider adapter for a hosted free-tier provider, with a fake local test provider |
| File storage | Local storage in development; S3-compatible object storage in production |

## Important interpretation of “free”

The application can be free to users, but hosted AI inference always consumes somebody's compute quota. No third-party provider should be assumed to remain free forever. The design therefore supports:

1. A deterministic fake provider for zero-cost development and tests.
2. A configurable hosted provider (Gemini is the selected beta provider) that may offer a free tier.
3. Per-user daily limits, caching, and graceful behavior when a quota is exhausted.
4. A future bring-your-own-key option without changing application features.

Provider secrets must only exist on the server. They must never be shipped in the React bundle.

## Planning documents

- [Product plan](./product-plan.md) — audience, scope, user journeys, requirements, and success measures.
- [UX plan](./ux-plan.md) — navigation, screens, mobile behavior, and accessibility.
- [Technical architecture](./architecture.md) — system boundaries, repository layout, AI flow, security, and deployment.
- [Data model](./data-model.md) — MongoDB collections, relationships, indexes, and retention.
- [API specification](./api-spec.md) — REST endpoints, payloads, streaming, and error conventions.
- [Delivery roadmap](./roadmap.md) — implementation phases, acceptance criteria, tests, risks, and backlog.
- [AI runtime decision](./ai-runtime-decision.md) — hosted/local runtime choice, $0 budget, quotas, and privacy notes.

## MVP definition

The MVP is complete when a student can:

- Create an account and sign in.
- Create a subject and add pasted study notes.
- Generate, view, regenerate, and save a structured summary.
- Generate a multiple-choice quiz, answer it, and see explanations and a score.
- Chat with a tutor that answers from the selected study material and clearly says when the material does not contain an answer.
- Reopen prior summaries, quiz attempts, and conversations on a mobile device.
- Install the app to the device home screen and use the shell on a weak connection.

PDF upload, OCR, collaboration, subscriptions, and native app-store packages are deliberately outside the first MVP.
