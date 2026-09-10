import * as Sentry from "@sentry/node";
import { env } from "../config/env.js";

const enabled = Boolean(env.SENTRY_DSN);

if (enabled) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      // Study content, cookies, headers, query strings, and account details must
      // never be sent to an error-reporting provider.
      event.request = event.request
        ? { method: event.request.method, url: event.request.url?.split("?")[0] }
        : undefined;
      event.user = undefined;
      event.extra = undefined;
      return event;
    }
  });
}

type ErrorContext = { requestId?: string; method?: string; path?: string; source?: string };

export function reportException(error: unknown, context: ErrorContext = {}): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    scope.setTags({
      source: context.source ?? "api",
      ...(context.method ? { method: context.method } : {}),
      ...(context.path ? { path: context.path } : {})
    });
    if (context.requestId) scope.setTag("request_id", context.requestId);
    Sentry.captureException(error);
  });
}

export async function flushErrorReports(timeoutMs = 2_000): Promise<void> {
  if (enabled) await Sentry.flush(timeoutMs);
}
