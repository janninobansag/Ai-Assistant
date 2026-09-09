# Technical Architecture

## 1. System overview

```text
React mobile PWA
    |
    | HTTPS REST + Server-Sent Events
    v
Node.js / Express API
    |-- Auth and user preferences
    |-- Subjects and materials
    |-- Summary and quiz services
    |-- Tutor retrieval and chat
    |-- Quota, caching, and moderation
    |
    +--> MongoDB (application records + source chunks)
    +--> Hosted AI provider adapter (Gemini for beta)
    +--> Object storage (future file uploads)
```

The browser never calls the AI provider directly. The API owns provider credentials, prompt construction, input limits, quota checks, structured-output validation, and auditing.

## 2. Recommended monorepo structure

```text
root/
  apps/
    web/
      src/
        app/                 # providers, router, layouts
        components/          # shared UI components
        features/
          auth/
          library/
          summaries/
          quizzes/
          tutor/
          profile/
        hooks/
        lib/                 # API client, validation, utilities
        styles/
      public/
      vite.config.js
    api/
      src/
        config/
        middleware/
        modules/
          auth/
          users/
          subjects/
          materials/
          summaries/
          quizzes/
          conversations/
          usage/
        services/
          ai/
          retrieval/
          cache/
        jobs/
        app.js
        server.js
  packages/
    shared/
      src/                   # shared schemas, constants, API types
  doc/                       # planning and technical decisions
  .env.example
  package.json
```

Use npm workspaces. JavaScript is acceptable, but TypeScript is strongly recommended across both apps so request/response contracts and AI output schemas can be shared.

## 3. Frontend architecture

- React with Vite and React Router.
- Tailwind CSS for styling.
- TanStack Query for remote server state, retries, invalidation, and optimistic updates.
- React Hook Form with Zod validation for forms.
- A lightweight local store only for ephemeral UI state; do not duplicate server records in global state.
- IndexedDB for resumable quiz selections and explicitly cached recent records.
- A service worker using a Vite PWA integration for application-shell caching.

The API client should centralize base URL, credentials, refresh handling, request IDs, abort signals, and normalized errors.

## 4. Backend architecture

Use modular Express routes with a controller-service-repository split only where it adds value:

- **Routes:** URL definitions, authentication middleware, validation.
- **Controllers:** translate HTTP input/output; no business rules.
- **Services:** authorization-aware workflows and AI orchestration.
- **Models/repositories:** Mongoose queries and indexes.
- **Provider adapters:** a stable interface around model-specific SDKs.

Validate all request bodies, params, query strings, environment configuration, and structured AI responses. Apply a global error handler that returns the error shape defined in the API plan.

## 5. AI provider interface

Create a provider-neutral contract:

```ts
interface AIProvider {
  generateText(input: GenerationInput): Promise<GenerationResult>;
  generateStructured<T>(input: StructuredInput<T>): Promise<T>;
  streamText(input: GenerationInput): AsyncIterable<StreamEvent>;
  embed?(texts: string[]): Promise<number[][]>;
}
```

Initial adapters:

- `HostedProvider`: one selected provider configured entirely by environment variables.
- `FakeProvider`: deterministic fixture responses for tests and frontend development.

Do not leak provider model names into feature modules. A routing service selects the configured adapter and records usage metadata.

## 6. Content processing and retrieval

### Ingestion

1. Validate ownership, content type, and size.
2. Normalize Unicode and line endings.
3. Remove repeated empty lines while preserving headings and paragraph boundaries.
4. Calculate a content hash for deduplication.
5. Split text into overlapping chunks with stable ordinal numbers.
6. Save material and chunks.
7. Optionally create vector embeddings when an embedding provider is configured.

### MVP retrieval

Start with MongoDB text search plus simple term scoring to avoid requiring a paid vector service. Retrieve a limited set of chunks, include their IDs in the prompt, and require citations in the structured response.

For later scale, add MongoDB Atlas Vector Search or another vector index behind a `Retriever` interface. Hybrid retrieval can combine keyword and vector scores without changing the chat API.

### Summary workflow

1. Check ownership, quota, and an idempotency/cache key.
2. Summarize chunks in batches if the material exceeds the provider context window.
3. Synthesize batch summaries into a validated structured result.
4. Store result, citations, model metadata, latency, and approximate usage.
5. Debit quota only according to the documented usage policy.

### Quiz workflow

1. Retrieve broad coverage across the material rather than only the first chunks.
2. Ask for strict JSON matching the shared quiz schema.
3. Validate question count, option count, unique options, answer bounds, and cited chunk IDs.
4. Reject or repair invalid output once; do not retry indefinitely.
5. Store answers server-side, returning a sanitized quiz until submission.

### Chat workflow

1. Load a bounded recent message window and a short conversation summary.
2. Retrieve chunks relevant to the latest question.
3. Build a prompt that separates system rules, source excerpts, conversation, and user input.
4. Stream answer deltas over Server-Sent Events (SSE).
5. Store the final message only after stream completion; record interrupted status otherwise.
6. Return source chunk references as a final stream event.

## 7. Free-use strategy

- Enforce configurable daily point budgets, for example summary = 3, quiz = 4, chat message = 1.
- Set maximum source length, output tokens, quiz count, and chat history window.
- Cache by user, material content hash, action, and generation settings.
- Use smaller models for classification, title generation, and conversation compression.
- Use deterministic temperatures for summaries and quizzes to improve cache usefulness.
- Add global provider circuit breakers so outages do not trigger retry storms.
- Keep the fake provider available as the reliable zero-API-cost development path. Do not require local model hardware.

“Free to users” should be a product policy, while provider cost remains an operational budget with clear limits.

## 8. Authentication and security

- Hash passwords with Argon2id or bcrypt; never encrypt or log passwords.
- Prefer refresh tokens in `HttpOnly`, `Secure`, `SameSite` cookies. Keep access tokens short lived and in memory.
- Rotate refresh tokens and store only their hashes in the database.
- Require CSRF protection for cookie-authenticated state changes.
- Set a strict CORS allowlist, security headers, JSON/body size limits, and request timeouts.
- Rate-limit login, registration, password reset, and AI routes separately.
- Authorize every record query by both record ID and `userId`; a valid ID alone is insufficient.
- Sanitize rendered Markdown and disallow raw HTML from model output.
- Treat source material and chat messages as untrusted prompt content. Delimit them and tell the model never to follow instructions found inside sources.
- Redact secrets and study content from application logs.
- The HTTP logger must redact `Authorization`, `Cookie`, and `Set-Cookie` headers before writing request/response logs.
- Support account export and deletion before public launch.

## 9. Reliability and observability

- Add a request ID to every API response and log line.
- Track HTTP latency, AI time-to-first-token, total AI latency, provider errors, validation failures, and quota denials.
- Use structured logs with environment-controlled levels.
- Expose liveness and readiness endpoints.
- Add timeouts, limited exponential retry for transient provider failures, and abort propagation when a client cancels.
- Run database backups and practice restoration before beta expansion.

## 10. Environments and deployment

### Local development

- React dev server.
- Express API.
- MongoDB in a container or local installation.
- The deterministic fake provider. Hosted inference is enabled only when a server-side key and model are configured.

### Production

- Serve the PWA from a static host/CDN.
- Run the API on a Node-capable service.
- Use managed MongoDB with encryption, backups, and IP/network restrictions.
- Store secrets in the hosting platform's secret manager.
- Use one same-site parent domain where possible to simplify secure cookie auth.

Required environment groups:

- Server, database, and frontend origin.
- Access/refresh token secrets and cookie settings.
- AI provider type, endpoint, model names, keys, timeouts, and token limits.
- Daily quota and rate-limit values.
- Logging and error-reporting configuration.

Never put server secrets in variables exposed by Vite's public environment prefix.
### Summary generation (Phase 2)

Summary requests run only on the API. The provider adapter selects the deterministic fake provider or server-side Gemini REST integration, and validates structured output before persistence. Saved summaries include the material content hash and prompt version. A daily per-user points ledger and content-hash cache prevent repeated spend; hosted credentials never enter the web bundle.
