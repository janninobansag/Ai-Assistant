# MongoDB Data Model

All collections use timestamps. User-owned records include `userId`, and every API query must scope by it. IDs below are MongoDB ObjectIds unless stated otherwise.

## 1. Collections

### users

```text
_id
email                 normalized, unique
passwordHash
displayName
educationLevel        secondary | undergraduate | postgraduate | other
preferences           { answerLength, theme, allowGeneralKnowledge }
status                active | disabled | deletionPending
lastLoginAt
createdAt, updatedAt
```

Indexes: unique `email`; `status` for administrative operations.

### refreshSessions

```text
_id
userId
tokenHash             unique
userAgentSummary
ipHash
expiresAt
revokedAt
replacedBySessionId
createdAt, updatedAt
```

Indexes: unique `tokenHash`; TTL on `expiresAt`; `{ userId, revokedAt }`.

### subjects

```text
_id
userId
name
description
colorKey              controlled semantic color name
status                active | archived
lastStudiedAt
createdAt, updatedAt
```

Indexes: `{ userId, status, updatedAt: -1 }`; unique active-name behavior should be enforced in service validation if archived duplicates are allowed.

### materials

```text
_id
userId
subjectId
title
sourceType            text (MVP)
rawText
normalizedText
contentHash
tags[]
characterCount
processingStatus      pending | ready | failed
processingErrorCode
archivedAt
createdAt, updatedAt
```

Indexes: `{ userId, subjectId, archivedAt }`; `{ userId, contentHash }`; text index on `title`, `tags`, and optionally `normalizedText` after checking index size.

### materialChunks

```text
_id
userId
materialId
subjectId
ordinal
heading
text
tokenEstimate
searchTerms[]
embedding             optional; omitted unless vector search is enabled
createdAt, updatedAt
```

Indexes: unique `{ materialId, ordinal }`; `{ userId, subjectId }`; text index on `heading` and `text`; optional vector index in a supported deployment.

### summaries

```text
_id
userId
subjectId
materialId
sourceContentHash
style                 concise | detailed | bullets
title
overview
keyPoints[]
definitions[]         { term, meaning }
rememberThis[]
citations[]           { chunkId, label }
generation            { provider, model, promptVersion, latencyMs, inputTokens, outputTokens }
status                completed | failed
createdAt, updatedAt
```

Indexes: `{ userId, materialId, createdAt: -1 }`; cache lookup on `{ userId, sourceContentHash, style, "generation.promptVersion" }`.

### quizzes

```text
_id
userId
subjectId
materialId
sourceContentHash
difficulty            easy | mixed | hard
questionCount
questions[]           {
  prompt,
  options[],
  correctOptionIndex,
  explanation,
  concept,
  citationChunkIds[]
}
generation            { provider, model, promptVersion, latencyMs, inputTokens, outputTokens }
createdAt, updatedAt
```

The correct answer is stored but removed by the response serializer before an unsubmitted attempt is returned.

Indexes: `{ userId, materialId, createdAt: -1 }`; cache lookup using content hash, difficulty, count, and prompt version.

### quizAttempts

```text
_id
userId
quizId
answers[]             { questionIndex, selectedOptionIndex, answeredAt }
status                inProgress | submitted | abandoned
score                  present after submission
correctCount           present after submission
weakConcepts[]
startedAt
submittedAt
createdAt, updatedAt
```

Indexes: `{ userId, status, updatedAt: -1 }`; `{ userId, quizId, createdAt: -1 }`.

### conversations

```text
_id
userId
subjectId
materialIds[]
title
summary               compressed older conversation context
lastMessageAt
archivedAt
createdAt, updatedAt
```

Indexes: `{ userId, archivedAt, lastMessageAt: -1 }`; multikey `{ userId, materialIds }`.

### messages

```text
_id
userId
conversationId
role                  user | assistant
content
status                pending | streaming | completed | interrupted | failed
citations[]           { materialId, chunkId, label }
generation            assistant only: provider/model/token metadata
clientMessageId       idempotency value supplied by client
createdAt, updatedAt
```

Indexes: `{ conversationId, createdAt }`; unique sparse `{ userId, clientMessageId }`.

### usageDaily

```text
_id
userId
dateKey               UTC date string, e.g. 2026-09-09
pointsUsed
counts                { summaries, quizzes, chatMessages }
tokens                 { input, output }
updatedAt
```

Index: unique `{ userId, dateKey }`. Update counters atomically.

### aiOperations

```text
_id
userId
operationType         summary | quiz | chat
resourceType
resourceId
requestId
status                started | completed | failed | quotaDenied | cancelled
provider
model
latencyMs
inputSizeBand
inputTokens
outputTokens
errorCode
createdAt, updatedAt
```

Do not store raw source or prompt text here. Add a TTL index if detailed operational events are only needed temporarily.

## 2. Relationship rules

- Deleting or archiving a subject must not leave its materials visible in normal queries.
- Hard deletion of an account should run as a background cascade over all `userId` records.
- Editing source text creates a new content hash. Existing summaries and quizzes remain historical artifacts and must be labeled as generated from an older version.
- A conversation's `materialIds` are fixed for an individual answer request, even if the user changes scope immediately afterward.
- Quiz scoring occurs only on the server from the stored quiz answer key.

## 3. Validation limits for the MVP

Exact numbers should be configuration values, with initial product defaults such as:

- Subject name: 1–80 characters.
- Material title: 1–120 characters.
- Pasted material: 100–50,000 characters.
- Tags: up to 10, each 1–30 characters.
- User chat message: 1–2,000 characters.
- Conversation material scope: up to 10 materials.
- Quiz options: exactly 4 per question.

## 4. Data retention

- Keep active user content until the user deletes it.
- Revoke sessions immediately on sign out; remove expired sessions with a TTL index.
- Keep operational AI events for a limited window, such as 30–90 days.
- On account deletion, schedule a short recovery window, then hard-delete user content and provider-side files if any exist.
- Document whether the chosen AI provider retains prompts and configure zero-retention options when available.
