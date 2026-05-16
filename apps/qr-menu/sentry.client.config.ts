import * as Sentry from "@sentry/nextjs";
import { clientEnv } from "@/lib/env.client";

Sentry.init({
  dsn: clientEnv.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  release: process.env.COOLIFY_GIT_COMMIT_SHA ?? "local",
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
  ],
  beforeSend(event) {
    return stripPii(event);
  },
});

function stripPii(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (event.request) {
    if (event.request.query_string) {
      event.request.query_string = redactQuery(
        event.request.query_string as QueryLike,
      );
    }
    if (event.request.data && typeof event.request.data === "object") {
      event.request.data = redactObject(
        event.request.data as Record<string, unknown>,
      );
    }
  }
  if (event.extra) {
    event.extra = redactObject(event.extra) as typeof event.extra;
  }
  return event;
}

type QueryLike = string | Record<string, string> | Array<[string, string]>;

const SECRET_KEY_PATTERN = /(token|secret|password|api[_-]?key|stripe[_-]?secret)/i;

function redactObject(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEY_PATTERN.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactObject(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function redactQuery(qs: QueryLike): string {
  const entries: Array<[string, string]> = Array.isArray(qs)
    ? qs
    : typeof qs === "string"
      ? qs
          .split("&")
          .map((pair): [string, string] => {
            const [k, ...rest] = pair.split("=");
            return [k ?? "", rest.join("=")];
          })
      : Object.entries(qs);
  return entries
    .map(
      ([k, v]) => `${k}=${SECRET_KEY_PATTERN.test(k) ? "[redacted]" : v}`,
    )
    .join("&");
}
