# AI Runtime Decision — Phase 0

**Decision:** Use a provider-neutral AI adapter with Gemini Developer API Free Tier as the hosted beta runtime and the deterministic fake provider for automated tests and frontend development. Do not require Ollama or any local model runtime.

## Why this combination

| Runtime | Role | Cost posture | Tradeoff |
| --- | --- | --- | --- |
| Fake provider | CI, UI development, demos | $0 | No real AI quality; deterministic only |
| Gemini Developer API Free Tier | Hosted beta inference | $0 while the project remains inside its free quota and has no paid billing path | Quotas are project-level and can change; free-tier content may be used to improve Google's products according to its pricing terms |

Gemini's official pricing page currently lists free input and output tokens for its Free tier, while also stating that access is limited to certain models and that free-tier content may be used to improve products: [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing). Gemini rate limits are evaluated per project and include requests per minute, tokens per minute, and requests per day: [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

These links are references, not guarantees. Re-check them before production because provider models, limits, regions, and terms can change.

## Hosted free-use budget

### Hard financial policy

- Target provider spend: **$0 per calendar month** for the free beta.
- Do not attach a paid billing account to the beta project until an explicit owner approval is recorded.
- If a provider requires billing to obtain an API key, keep the provider disabled and use the fake provider instead. Never rely on an unobserved pay-as-you-go fallback.
- The API must fail closed when the configured hosted budget or quota is unavailable; it must not silently switch to a paid model.

### Application limits

Use points rather than raw requests so expensive operations consume more budget:

| Operation | Points | Initial per-user daily allowance |
| --- | ---: | ---: |
| Summary | 3 | Up to 6 summaries if used alone |
| Quiz generation | 4 | Up to 5 quizzes if used alone |
| Tutor chat message | 1 | Up to 20 messages if used alone |

- Per-user limit: **20 points/day**.
- Global beta safety cap: **500 AI operations/day** across all users.
- Maximum source input per request: **50,000 characters** before chunking.
- Maximum summary output: **1,200 tokens**.
- Maximum quiz size: **15 questions**, four options each.
- Maximum chat output: **700 tokens** per message.
- Maximum chat context: the latest 12 messages plus a bounded set of retrieved chunks.
- Cache identical summary and quiz requests by content hash, settings, and prompt version.

The global cap is an operational circuit breaker, not a claim about the provider's quota. Start lower if the provider's current project quota is lower.

### Quota behavior

1. Check the user's points and global operation count atomically before calling the provider.
2. Reject with `AI_QUOTA_EXCEEDED` when either cap is reached.
3. Keep all existing study content readable.
4. Expose the reset time and remaining points through `/api/v1/usage/today`.
5. Record provider errors and quota denials without storing raw prompts or source text.
6. Allow an operator to switch between `AI_PROVIDER=fake` and `AI_PROVIDER=hosted` without changing feature code.

## Privacy decision

The product must disclose that hosted Free-tier material may be processed under the provider's terms. The first release should offer a source-only chat mode and a clear provider notice. Do not advertise hosted free-tier processing as private or zero-retention unless the provider terms for the selected project explicitly support that claim.

## Environment contract

```dotenv
AI_PROVIDER=fake                 # fake | hosted
HOSTED_AI_PROVIDER=gemini
HOSTED_AI_MODEL=                 # set after selecting a currently free model
GEMINI_API_KEY=                  # server-only; never expose to Vite
DAILY_POINTS_LIMIT=20
GLOBAL_DAILY_AI_OPERATIONS=500
AI_MONTHLY_SPEND_LIMIT_USD=0
```

Keep the model name blank until the operator confirms the current free-tier model and region in the provider console. The provider adapter should reject a hosted configuration with a missing model rather than guessing.

## Phase 0 completion checklist

- [x] Hosted runtime selected: Gemini Developer API Free Tier.
- [x] Local development runtime selected: fake provider (no local model required).
- [x] Test runtime selected: fake provider.
- [x] Application spend policy set to $0/month.
- [x] Per-user budget set to 20 points/day.
- [x] Global safety cap set to 500 operations/day.
- [ ] Verify the selected Gemini model and current quota in the project console.
- [ ] Add provider credentials only in the deployment secret manager.
- [ ] Complete a privacy/terms review before inviting external beta users.
