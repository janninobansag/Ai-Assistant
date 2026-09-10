# Private-beta release checklist

## Before deployment

- [ ] Commit and push the intended branch.
- [ ] Set production `WEB_ORIGIN` and `VITE_API_URL` to HTTPS URLs.
- [ ] Set long unique token secrets and keep `.env` out of Git.
- [ ] Configure MongoDB Atlas IP access and a database user with only required privileges.
- [ ] Enable Atlas backups and record how to restore into a separate test database.
- [ ] Configure hosting health checks to call `/api/v1/health/live` and `/api/v1/health/ready`.
- [ ] Monitor `/api/v1/health/metrics`; it reports only aggregate request counts, never study content.
- [ ] Replace the draft privacy-policy placeholders with operator name, contact email, providers, retention policy, and jurisdiction.

## Smoke test on deployment

- [ ] Register, sign in, add a subject and material.
- [ ] Generate a summary and quiz; submit a quiz.
- [ ] Ask the tutor a question and open a source citation.
- [ ] Confirm the daily quota and rate-limit errors are understandable.
- [ ] Export data, then verify a test-account deletion removes its records.
- [ ] Install on Android Chrome and verify the update prompt.
- [ ] On iPhone Safari, use Share → Add to Home Screen and document any platform limitation.
- [ ] Test at 320px width and 200% browser zoom.

## Do not mark public release complete until

- [ ] A recent backup has been restored successfully in a test environment.
- [ ] A real HTTPS deployment has passed the smoke test.
- [ ] A legal/privacy review appropriate to the launch jurisdiction is complete.
