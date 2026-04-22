import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

Sentry.init({
  dsn: env.SENTRY_DSN ?? env.NEXT_PUBLIC_SENTRY_DSN,
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

type QueryLike = string | Record<string, string> | Array<[string, string]>;

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
    if (event.request.cookies) {
      event.request.cookies = { redacted: "[redacted]" };
    }
    if (event.request.headers) {
      const headers = event.request.headers as Record<string, string>;
      for (const h of ["authorization", "cookie", "stripe-signature"]) {
        if (headers[h]) headers[h] = "[redacted]";
      }
    }
  }
  if (event.extra) {
    event.extra = redactObject(event.extra) as typeof event.extra;
  }
  return event;
}

const SECRET_KEY_PATTERN = /(token|secret|password|api[_-]?key|stripe[_-]?secret)/i;
// Strip Stripe customer-detail fields beyond the id itself.
const STRIPE_CUSTOMER_FIELDS = new Set([
  "email",
  "name",
  "phone",
  "address",
  "shipping",
  "description",
  "receipt_email",
]);

function redactObject(
  obj: Record<string, unknown>,
  path: string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const inStripe = path.some((p) => /^(customer|charge|payment_intent)/i.test(p));
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEY_PATTERN.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (inStripe && STRIPE_CUSTOMER_FIELDS.has(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactObject(v as Record<string, unknown>, [...path, k]);
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
