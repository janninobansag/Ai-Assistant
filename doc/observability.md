# Observability and backup operations

## What is built in

- The API emits redacted request logs. Authorization headers, cookies, and `Set-Cookie` values are removed.
- `GET /api/v1/health/live` reports whether the process is running.
- `GET /api/v1/health/ready` reports whether MongoDB is connected; use this as the Render health-check path.
- `GET /api/v1/health/metrics` returns aggregate request counts and uptime only. It never returns study content.
- When `SENTRY_DSN` is configured, unhandled API errors are sent to Sentry with request metadata only. Study text, cookies, headers, query strings, user data, and extra payloads are stripped before sending.

## Configure Sentry on Render

1. Create a **Node.js** project in Sentry and copy its DSN.
2. In the Render API service, add these environment variables:

   ```text
   SENTRY_DSN=<the DSN from Sentry>
   SENTRY_ENVIRONMENT=production
   ```

3. Redeploy the API.
4. Trigger a safe test error in a non-production environment first, then confirm the Sentry event does not contain note content or credentials.

Leave `SENTRY_DSN` unset locally unless you intentionally want local development errors reported.

## Atlas backup and restore drill

1. In Atlas, enable a backup option available for the cluster plan and record its retention period.
2. Create a backup after adding a disposable test account and material.
3. Restore that backup into a **separate test database or cluster**, never over the live database.
4. Verify the test account, material, quiz attempt, and conversation are present.
5. Record the backup date, restore duration, and result in `release-checklist.md`.

The backup/restore drill is a required manual release gate because it uses your Atlas account and production data policy.
