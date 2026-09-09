# REST API Specification

Base path: `/api/v1`

JSON is used for normal requests and responses. Tutor streaming uses Server-Sent Events. Protected endpoints require a valid user session. Dates are ISO 8601 UTC strings.

## 1. Response conventions

### Success

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123"
  }
}
```

### Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": {
      "title": "Title is required."
    },
    "requestId": "req_123"
  }
}
```

Use stable machine-readable codes. Expected codes include `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `AI_QUOTA_EXCEEDED`, `AI_PROVIDER_UNAVAILABLE`, `AI_OUTPUT_INVALID`, and `INTERNAL_ERROR`.

Paginated lists use cursor pagination:

```json
{
  "data": [],
  "meta": {
    "nextCursor": "opaque-or-null",
    "requestId": "req_123"
  }
}
```

## 2. Authentication

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Create an account and session |
| POST | `/auth/login` | Create a session |
| POST | `/auth/refresh` | Rotate refresh token and issue access token |
| POST | `/auth/logout` | Revoke current session |
| POST | `/auth/logout-all` | Revoke every session for the user |
| GET | `/auth/me` | Return current user and preferences |
| PATCH | `/auth/me` | Update profile and preferences |

Example registration request:

```json
{
  "email": "student@example.com",
  "password": "long user password",
  "displayName": "Sam"
}
```

## 3. Subjects

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/subjects` | List active or archived subjects |
| POST | `/subjects` | Create a subject |
| GET | `/subjects/:subjectId` | Get subject details and counts |
| PATCH | `/subjects/:subjectId` | Rename or update appearance |
| POST | `/subjects/:subjectId/archive` | Archive subject |
| POST | `/subjects/:subjectId/restore` | Restore subject |
| DELETE | `/subjects/:subjectId` | Permanently delete after confirmation |

## 4. Materials

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/materials?subjectId=&q=&cursor=` | List/search materials |
| POST | `/materials` | Create and process pasted material |
| GET | `/materials/:materialId` | Get material metadata and source |
| PATCH | `/materials/:materialId` | Update title, tags, or source text |
| POST | `/materials/:materialId/archive` | Archive material |
| DELETE | `/materials/:materialId` | Permanently delete material and dependent records |

Create request:

```json
{
  "subjectId": "66f000000000000000000001",
  "title": "Cell division lecture",
  "text": "Mitosis is ...",
  "tags": ["biology", "exam-1"]
}
```

If processing becomes asynchronous later, return `202 Accepted` with a status resource. For the text-only MVP, bounded inputs can be processed synchronously.

## 5. Summaries

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/materials/:materialId/summaries` | Generate or return a cached summary |
| GET | `/materials/:materialId/summaries` | List saved summary versions |
| GET | `/summaries/:summaryId` | Read one summary |
| DELETE | `/summaries/:summaryId` | Delete one generated summary |

Generate request:

```json
{
  "style": "concise",
  "forceRegenerate": false
}
```

For requests that may be retried by the client, accept an `Idempotency-Key` header. Return `200` for a cache hit and `201` for a new summary, with `meta.cacheHit`.

## 6. Quizzes and attempts

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/materials/:materialId/quizzes` | Generate or return a cached quiz |
| GET | `/materials/:materialId/quizzes` | List quiz definitions without answer keys |
| GET | `/quizzes/:quizId` | Get a sanitized quiz |
| POST | `/quizzes/:quizId/attempts` | Start an attempt |
| GET | `/attempts/:attemptId` | Resume or review an owned attempt |
| PATCH | `/attempts/:attemptId/answers` | Save one or more draft answers |
| POST | `/attempts/:attemptId/submit` | Score and finalize the attempt |

Generate request:

```json
{
  "questionCount": 10,
  "difficulty": "mixed",
  "forceRegenerate": false
}
```

Draft-answer request:

```json
{
  "answers": [
    { "questionIndex": 0, "selectedOptionIndex": 2 }
  ]
}
```

Submit response contains the score and per-question feedback. No endpoint returns correct answers before submission.

## 7. Tutor conversations

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/conversations?subjectId=&cursor=` | List conversations |
| POST | `/conversations` | Create a conversation with source scope |
| GET | `/conversations/:conversationId` | Get metadata and recent messages |
| PATCH | `/conversations/:conversationId` | Rename or change future source scope |
| GET | `/conversations/:conversationId/messages?cursor=` | Page through messages |
| POST | `/conversations/:conversationId/messages` | Send message and stream answer |
| POST | `/conversations/:conversationId/archive` | Archive conversation |

Create request:

```json
{
  "subjectId": "66f000000000000000000001",
  "materialIds": ["66f000000000000000000002"],
  "title": "Mitosis review"
}
```

Message request:

```json
{
  "content": "Why is the metaphase checkpoint important?",
  "clientMessageId": "01JCLIENTGENERATEDID",
  "allowGeneralKnowledge": false
}
```

The response uses `text/event-stream` with named events:

```text
event: accepted
data: {"userMessageId":"...","assistantMessageId":"..."}

event: delta
data: {"text":"The checkpoint"}

event: citations
data: {"items":[{"materialId":"...","chunkId":"...","label":"Paragraph 4"}]}

event: done
data: {"usage":{"points":1}}
```

Also define `error` and `cancelled` events. Send heartbeats for long provider pauses and stop work when the client connection aborts.

## 8. Usage

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/usage/today` | Return limits, use counts, point balance, and reset time |
| GET | `/usage/history?days=30` | Optional usage history for the profile screen |

Example response:

```json
{
  "data": {
    "dateKey": "2026-09-09",
    "pointsUsed": 7,
    "pointsLimit": 20,
    "counts": {
      "summaries": 1,
      "quizzes": 1,
      "chatMessages": 0
    },
    "resetsAt": "2026-09-10T00:00:00.000Z"
  },
  "meta": { "requestId": "req_123" }
}
```

## 9. Operations

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health/live` | Process liveness; no dependency details |
| GET | `/health/ready` | Readiness based on required dependencies |

These endpoints must not reveal secrets, connection strings, internal hosts, or model credentials.

## 10. API implementation rules

- Validate ObjectIds before database queries.
- Return `404` for records not owned by the caller to avoid revealing their existence.
- Apply size limits before parsing large inputs.
- Use atomic operations for usage counters and attempt submission.
- Version prompts independently from the HTTP API and store the prompt version on generated records.
- Generate and propagate request IDs.
- Include automated OpenAPI generation or maintain an OpenAPI document once implementation begins.
