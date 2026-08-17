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
    "The router state header was sent but could not be parsed.",
    "Failed to find Server Action",
    "Failed to parse body as FormData.",
  ],
});
