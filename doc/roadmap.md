# Delivery Roadmap

The roadmap is organized as outcome-based phases. A small team can treat each phase as roughly one week, but estimates should be revised after the AI provider and hosting choices are made.

## Phase 0 — Decisions and foundation

### Deliverables

- [x] Confirm PWA rather than React Native.
- [x] Select TypeScript or JavaScript; TypeScript is recommended.
- [x] Choose AI runtime and define the hosted free-use budget. See [AI runtime decision](./ai-runtime-decision.md).
- [x] Create npm-workspace monorepo for `apps/web`, `apps/api`, and `packages/shared`.
- [x] Configure linting, formatting, test runners, and CI.
- [x] Add environment validation and documented provider configuration.
- [x] Create shared response/error and validation schemas.
- [x] Establish Tailwind tokens and basic mobile shell.

### Exit criteria

- [x] Web and API start with one development command.
- [x] CI runs lint, type checks, and unit tests. See `.github/workflows/ci.yml`.
- [x] The fake AI provider produces deterministic fixture output.
- [x] No secrets or machine-specific environment files are committed.

## Phase 1 — Accounts and study library

Status: **Complete**. This roadmap is the single Phase 1 progress tracker.

Current slice: authentication, persisted refresh-session rotation, session restoration after browser refresh, MongoDB models, ownership checks, subject/material CRUD, material chunk persistence, and the mobile library UI are implemented and verified. Phase 1 exit tests now pass. Keep all phase progress in this roadmap.

Security note: request logging now redacts authorization and cookie headers. If tokens have appeared in copied logs, rotate both token secrets before continuing.

Database note: refresh-session expiration uses one TTL index on `expiresAt`; duplicate index declarations were removed from the schema.

### Deliverables

- [x] Registration, login, refresh, logout, logout-all, and profile preferences.
- [x] Protected routing and authenticated API client with refresh-cookie session restoration.
- [x] Subject create/list/edit/archive/delete flows.
- [x] Pasted-text material create/read/edit/archive/delete flows.
- [x] Text normalization, content hashing, and chunk creation.
- [x] Mobile Home/library/subject/material flows in the first vertical slice.

### Exit criteria

- [x] Two test users cannot read or mutate one another's records.
- [x] Session rotation and logout are covered by integration tests.
- [x] A user can paste 50,000 characters without freezing the mobile UI.
- [x] Empty, loading, validation, server-error, and offline states are present.

## Phase 2 — Summary generation

Status: **In progress**. Summary generation, validation, caching, and the initial mobile result/copy slice are implemented. Long-material synthesis, global quota enforcement, and full history UX remain.

### Deliverables

- [x] Provider adapter and server-side prompt templates.
- [x] Structured summary schema and output validation.
- [x] Long-material batch and synthesis flow (chunk map-reduce with bounded provider inputs).
- [x] Summary configuration, result, history, copy, and regenerate UI (initial result/copy slice).
- [x] Usage accounting, caching, idempotency, timeouts, and error handling (per-user points and cache).

### Exit criteria

- [x] Every saved summary references the source content hash and prompt version.
- [x] Invalid model output cannot be persisted as a completed summary.
- [x] Identical requests can return a cache hit without another provider call.
- [x] Provider credentials are absent from frontend files and network requests.

## Phase 3 — Quiz generation and practice

Status: **In progress**. Strict quiz generation, validation, caching, and answer-sanitized quiz responses are implemented; attempts, scoring, and practice history remain.

### Deliverables

- [x] Strict quiz generation and validation.
- [x] Sanitized quiz serializers that hide answers.
- [ ] Start, autosave, resume, submit, score, and retry flows.
- [ ] Quiz result analysis and weak-concept list.
- [ ] Practice history screen.

### Exit criteria

- [ ] Correct answers cannot be obtained from pre-submission API responses.
- [ ] Submission is idempotent and cannot consume quota twice.
- [ ] Refreshing or closing the app does not lose a saved in-progress attempt.
- [ ] Scoring tests cover blank, partial, complete, and repeated submissions.

## Phase 4 — Grounded tutor chat

### Deliverables

- [ ] Keyword retrieval over material chunks.
- [ ] Conversation and message persistence.
- [ ] SSE response streaming, cancellation, and interrupted-message handling.
- [ ] Citations that open the matching material excerpt.
- [ ] Context-window trimming and conversation summarization.
- [ ] Prompt-injection boundaries for untrusted study material.

### Exit criteria

- [ ] Chat cannot access another user's chunks.
- [ ] Answers cite only chunks supplied to that generation request.
- [ ] The assistant states when the selected material does not support an answer.
- [ ] Disconnecting stops or safely finalizes provider work.
- [ ] Streaming works over the chosen production hosting path.

## Phase 5 — PWA hardening and beta

### Deliverables

- [ ] Manifest, install assets, service worker, update flow, and offline screen.
- [ ] Mobile accessibility and responsive-layout audit.
- [ ] Rate limiting, abuse controls, provider circuit breaker, and quota UI.
- [ ] Structured logging, metrics, error reporting, health checks, and database backups.
- [ ] Privacy policy, terms, AI disclosure, account export, and account deletion.
- [ ] Production deployment and smoke-test checklist.

### Exit criteria

- [ ] Core screens work at 320px width and with 200% zoom.
- [ ] Install and update flows pass on current Android Chrome and iOS Safari limitations are documented.
- [ ] An automated accessibility scan has no serious or critical issue on core routes.
- [ ] Provider outage and quota exhaustion fail gracefully without losing user content.
- [ ] Restore from a recent database backup has been tested.

## Test strategy

### Unit tests

- [ ] Text normalization and chunk boundaries.
- [ ] Quota point calculation and reset dates.
- [ ] AI structured-output parsers.
- [ ] Quiz scoring and weak-concept calculation.
- [ ] Authorization query builders and response serializers.

### API integration tests

- [ ] Auth lifecycle and refresh-token rotation.
- [ ] Ownership isolation on every resource type.
- [ ] Material-to-chunk persistence.
- [ ] Summary and quiz caching/idempotency.
- [ ] Attempt submission concurrency.
- [ ] AI provider timeout, malformed output, and quota errors.

Use a real ephemeral MongoDB test instance where feasible and the fake AI provider for deterministic results.

### Frontend component/integration tests

- [ ] Form validation and preservation after errors.
- [ ] Loading, empty, quota, offline, and provider-error states.
- [ ] Quiz navigation, autosave, submit, and review.
- [ ] Streaming message rendering and cancellation.
- [ ] Keyboard/focus behavior for dialogs, tabs, and bottom navigation.

### End-to-end tests

1. [ ] Register, create subject, and add material.
2. [ ] Generate and reopen a summary.
3. [ ] Generate, complete, and review a quiz.
4. [ ] Ask a grounded tutor question and open a citation.
5. [ ] Exhaust a test quota and confirm existing content remains usable.
6. [ ] Verify one account cannot access another account's guessed IDs.

## Main risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Free provider changes limits or disappears | AI features stop | Provider adapter, fake-provider development path, circuit breaker, explicit quota messaging |
| Model returns malformed quiz data | Broken or unfair quizzes | Strict schema validation, bounded repair retry, deterministic fake-provider tests |
| Hallucinated tutor answers | Loss of trust | Retrieval, chunk citations, source-only mode, evaluation set, uncertainty behavior |
| Long notes exceed context window | Failure or high cost | Input limits, chunking, map-reduce summaries, bounded retrieval |
| Prompt injection inside notes | Model ignores tutor rules | Treat source as quoted data, fixed system policy, output checks, no model-triggered tools in MVP |
| Answer key leaks | Invalid assessment | Server-only key, sanitized serializers, submission endpoint |
| Mobile connection drops during generation | Confusing state and wasted quota | Abort handling, operation status, idempotency, retry-safe UX |
| Sensitive study data appears in logs | Privacy incident | Structured metadata-only logs and redaction tests |
| Service-worker caching exposes private data | Shared-device privacy risk | Cache shell assets only; keep tokens and private API responses out of Cache Storage |

## Post-MVP backlog

- [ ] PDF and DOCX parsing with asynchronous processing.
- [ ] Image capture and OCR for handwritten or printed notes.
- [ ] Flashcards and spaced-repetition scheduling.
- [ ] Voice questions and read-aloud answers.
- [ ] Shared study groups and teacher-created material.
- [ ] Export to Markdown, printable PDF, or flashcard formats.
- [ ] Hybrid vector and keyword retrieval.
- [ ] Bring-your-own AI key.
- [ ] Multilingual summaries and quizzes.
- [ ] Capacitor packaging for app-store distribution if a native wrapper becomes necessary.

## Definition of done for every feature

- [ ] Acceptance criteria are met on mobile and desktop layouts.
- [ ] Authorization, validation, loading, empty, error, and quota states are handled.
- [ ] Unit/integration coverage exists for critical business rules.
- [ ] Accessibility names, focus behavior, and touch targets are verified.
- [ ] Logs and analytics contain no private content.
- [ ] Documentation and shared API schemas reflect the shipped behavior.
