# Product Plan

## 1. Product statement

AI Study Assistant is a mobile-first study workspace that turns a student's own notes into summaries, practice quizzes, and grounded tutor conversations. It should feel fast enough for short study sessions and simple enough to use one-handed on a phone.

## 2. Target users

### Primary user

A secondary-school or university student who studies mainly from lecture notes, copied text, and short documents and cannot justify a paid AI subscription.

### Secondary user

A self-directed learner preparing for an exam, certification, or job interview.

## 3. Core problem

Students spend time rewriting notes, inventing practice questions, and searching long source material. General chatbots can help but often lose the source context, hallucinate, or hide useful features behind paid plans.

## 4. Product principles

- **Source grounded:** Generated content should be based on the user's selected material.
- **Honest:** The tutor should identify uncertainty and missing source information.
- **Fast on mobile:** Primary actions should be reachable within two taps.
- **Study over novelty:** Retrieval, review, feedback, and history matter more than flashy generation.
- **Cost aware:** Conserve tokens, reuse results, limit abuse, and expose quota state clearly.
- **Private by default:** A user's material is private unless explicitly shared in a future release.

## 5. MVP scope

### Account and onboarding

- Register, sign in, sign out, refresh a session, and reset a password.
- Explain what data is sent to an AI provider before the first generation.
- Let the user select an education level and preferred answer length.

### Study library

- Create, rename, archive, and delete subjects.
- Add a study material by pasting text.
- Give each material a title, optional tags, and subject.
- Display processing status and validation errors.
- Search and filter the user's library.

### Summaries

- Generate one of three formats: concise, detailed, or bullet notes.
- Include key concepts, definitions, and a short “remember this” section.
- Save the result and generation settings.
- Regenerate without overwriting an older saved version.
- Copy summary text.

### Quizzes

- Generate 5, 10, or 15 multiple-choice questions.
- Select easy, mixed, or hard difficulty.
- Keep correct answers hidden until submission.
- Show score, correct answer, explanation, and weak concepts.
- Save every completed attempt.
- Retry incorrect questions.

### Tutor chat

- Start a conversation against one material or all materials in one subject.
- Stream responses into the interface.
- Cite the relevant material section or excerpt label in each grounded answer.
- Offer quick prompts such as “Explain simply,” “Give an example,” and “Quiz me on this.”
- Preserve conversation history.
- Refuse to invent an answer when the source does not support one, while optionally marking general-knowledge responses as outside the source.

### Usage controls

- Show a daily AI usage meter.
- Apply per-user and per-IP rate limits.
- Cache identical summary and quiz requests.
- Show a clear retry time or local-model option when hosted quota is unavailable.

## 6. Not in the MVP

- Native iOS or Android packages.
- PDF, Word, PowerPoint, audio, video, handwriting, and OCR ingestion.
- Live web research.
- Teacher dashboards or shared classrooms.
- Social features, public profiles, and shared flashcard decks.
- Payments and subscriptions.
- Automatic spaced repetition scheduling.
- Fully offline AI generation.

These are candidates for later phases; keeping them out protects the first release from file-parsing, moderation, and infrastructure complexity.

## 7. Main user journeys

### First study session

1. The student creates an account.
2. The student creates a subject such as Biology.
3. The student pastes notes, names the material, and saves it.
4. The server cleans and chunks the notes.
5. The student selects “Summarize,” chooses a style, and receives a saved summary.
6. The student generates a five-question quiz and submits answers.
7. The student opens tutor chat to ask about an incorrect concept.

### Returning session

1. The student lands on Home and sees recent subjects and activity.
2. The student opens a subject and resumes a conversation or quiz.
3. The app loads saved data immediately, then refreshes it from the server.

### Quota exhausted

1. The server blocks a new generation before contacting the hosted provider.
2. The UI preserves the user's input and shows when the quota resets.
3. Existing summaries, quizzes, and chats remain available.
4. If configured, the deployment can route to a local model or allow a user-supplied key later.

## 8. Functional requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-01 | Users can securely create and manage sessions. | Must |
| FR-02 | Users can manage private subjects and text materials. | Must |
| FR-03 | The system normalizes and chunks material for retrieval. | Must |
| FR-04 | Users can generate and save structured summaries. | Must |
| FR-05 | Users can generate, complete, and review quizzes. | Must |
| FR-06 | Users can stream tutor responses grounded in chosen material. | Must |
| FR-07 | The system tracks quota and rate-limits AI operations. | Must |
| FR-08 | Users can search their subjects and material titles. | Should |
| FR-09 | The PWA can be installed and cache its application shell. | Should |
| FR-10 | Users can export a summary as plain text or Markdown. | Could |

## 9. Non-functional requirements

- Mobile layouts support widths from 320px upward.
- Normal API reads should target a p95 response below 500 ms, excluding AI work.
- AI responses begin streaming when the provider supports it; target first content within 4 seconds under normal load.
- All protected records are checked against the authenticated user on the server.
- Passwords are hashed with Argon2id or bcrypt using a production-safe work factor.
- AI requests, retries, latency, provider, and approximate token usage are observable without logging private source text.
- The app remains usable with keyboard navigation, screen readers, 200% zoom, and reduced motion.
- Destructive actions require confirmation and use recoverable archival where practical.

## 10. Success measures

For a small beta, measure:

- Activation: percentage of new users who add material and complete one AI action.
- Study completion: percentage of started quizzes that are submitted.
- Grounding quality: sampled answers supported by their cited source chunk.
- Reliability: successful AI operations divided by attempts, separated by provider errors and quota blocks.
- Cost efficiency: average input/output tokens per completed study action.
- Retention: users returning within 7 days.

Do not use raw message content for analytics. Use event names, timestamps, feature settings, result status, and coarse size bands.

## 11. Decisions needed before implementation

- The initial AI runtime is the hosted Gemini free tier; the fake provider remains available for development and tests.
- For the private beta, email verification and password reset are deferred; account recovery becomes a pre-public-beta requirement.
- Decide whether general-knowledge chat is allowed or chat must remain strictly source-only.
- Set daily limits for summaries, quizzes, and chat messages.
- Revisit email verification and password-reset email before the public beta; they are intentionally deferred for the private beta.
- Choose production hosting and object storage vendors.
