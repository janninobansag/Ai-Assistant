# Administrator guide

## Assign an administrator

Administrator access is controlled only by the API host environment variable. It is never granted by the web app or an API request.

In Render, open the API service **Environment** settings and add:

```text
ADMIN_EMAILS=your-account-email@example.com
```

For more than one administrator, use a comma-separated list:

```text
ADMIN_EMAILS=first@example.com,second@example.com
```

Save the variable and let Render redeploy. Sign out and sign in again. The Settings panel will show **Manage users** only for an allowlisted account.

## Available actions

- View up to 200 newest user accounts with name and email only.
- Reset a user's password. This revokes the user's existing refresh sessions. A currently active access token can remain valid for up to 15 minutes.
- Permanently delete another user's account and all associated sessions, subjects, materials, chunks, summaries, quizzes, attempts, conversations, messages, and usage records.

Deletion requires typing the exact phrase `DELETE user@example.com` in the confirmation prompt. An administrator cannot delete their own account through the admin panel; use Settings → Delete account permanently instead.

## Security notes

- Keep `ADMIN_EMAILS` in Render only. Do not place it in Vercel or any `VITE_*` variable.
- Restrict the allowlist to accounts you control and remove addresses immediately when an administrator no longer needs access.
- Password reset and deletion are powerful, irreversible operations. Use them only for a verified account owner or according to your service policy.
