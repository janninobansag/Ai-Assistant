# Privacy, terms, and AI disclosure draft

Status: **Draft for private beta.** Replace every bracketed item and obtain appropriate legal review before public release.

## Privacy summary

Study Assistant stores the account information, study materials, generated summaries and quizzes, practice attempts, and tutor conversations needed to provide the service. A signed-in user can export this data or permanently delete their account from Settings.

When a user requests an AI feature, the required study text and request are sent to the configured AI provider. For tutor chat, the application limits the model context to the selected study material. Generated content can be inaccurate and should be checked against the original material.

The application does not intentionally place access tokens or private API responses in the PWA cache.

## Information to complete before launch

- Operator/legal business name: **[add name]**
- Privacy contact email: **[add email]**
- Hosting, database, and AI providers: **[add providers and regions]**
- Data-retention period and backup-retention period: **[add policy]**
- Governing law and user jurisdiction: **[add jurisdiction]**
- Procedure for data-access and deletion requests: **[add process]**

## Terms and AI disclosure

Study Assistant provides educational support only. It is not medical, legal, financial, or other professional advice. Users remain responsible for checking generated summaries, quizzes, and tutor answers against their source material and for deciding how to use the results.

Users must not upload content they do not have the right to use, attempt to bypass usage limits, or use the service to harm others. The operator may suspend access to protect the service or comply with law.

## Account controls

The account export endpoint returns the authenticated user’s stored content without password hashes or refresh-session tokens. Account deletion requires the current password and deletes the user record, sessions, subjects, materials, chunks, generated outputs, attempts, conversations, messages, and usage records.
