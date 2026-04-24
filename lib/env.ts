import { z } from "zod";

const urlSchema = z.string().url();
const httpsUrlSchema = z
  .string()
  .url()
  .refine((v) => v.startsWith("https://"), {
    message: "must be an https:// URL",
  });
const emailSchema = z.string().email();
const base64Schema = z
  .string()
  .regex(/^[A-Za-z0-9+/_-]+=*$/, "must be base64 (url-safe allowed)")
  .min(32, "base64 string looks too short to be a real key");
const vapidSubjectSchema = z
  .string()
  .refine((v) => v.startsWith("mailto:") || v.startsWith("https://"), {
    message: "VAPID_SUBJECT must be a mailto: or https:// URL",
  });
const booleanFromString = z
  .enum(["true", "false"])
  .transform((v) => v === "true");

// `next build` evaluates route modules (for manifests, page data, etc.) even
// for routes marked force-dynamic. Any import chain that reaches this module
// runs during the build phase. Prod secrets aren't required to compile — gate
// in a placeholder only when NEXT_PHASE=phase-production-build. At runtime
// (server boot, request handling), missing values still fail validation.
const buildPhaseFallback =
  <T>(value: T) =>
  (v: unknown) => {
    const missing = v === undefined || v === null || v === "";
    if (missing && process.env.NEXT_PHASE === "phase-production-build") {
      return value;
    }
    return v;
  };

const adminEmailsSchema = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return [] as string[];
    return v
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  })
  .pipe(
    z.array(
      z.string().email("QUICKARTE_ADMIN_EMAILS entries must be valid emails"),
    ),
  );

const platformFeeBpsSchema = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return 0;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 10000) return 0;
    return Math.floor(n);
  });

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),

    // Always required
    DATABASE_URL: z.preprocess(
      buildPhaseFallback("postgres://build:build@localhost:5432/build"),
      urlSchema,
    ),
    BETTER_AUTH_SECRET: z.preprocess(
      buildPhaseFallback("build-phase-placeholder-secret-32chars"),
      z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 chars"),
    ),
    BETTER_AUTH_URL: z.preprocess(
      buildPhaseFallback("https://build.local"),
      urlSchema,
    ),
    NEXT_PUBLIC_APP_URL: urlSchema,
    NEXT_PUBLIC_CANONICAL_URL: httpsUrlSchema,

    // Required in production only
    STRIPE_SECRET_KEY: z
      .string()
      .regex(/^sk_/, "must start with sk_")
      .optional(),
    STRIPE_PUBLISHABLE_KEY: z
      .string()
      .regex(/^pk_/, "must start with pk_")
      .optional(),
    STRIPE_WEBHOOK_SECRET: z
      .string()
      .regex(/^whsec_/, "must start with whsec_")
      .optional(),
    VAPID_PRIVATE_KEY: base64Schema.optional(),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: base64Schema.optional(),
    VAPID_SUBJECT: vapidSubjectSchema.optional(),
    RESEND_API_KEY: z
      .string()
      .regex(/^re_/, "must start with re_")
      .optional(),
    CONTACT_EMAIL_FROM: z
      .string()
      .refine(
        (v) => /<[^>]+@[^>]+>/.test(v) || /^[^\s@]+@[^\s@]+$/.test(v),
        { message: "must be an email or 'Name <addr@host>' string" },
      )
      .optional(),
    SENTRY_DSN: urlSchema.optional(),
    NEXT_PUBLIC_SENTRY_DSN: urlSchema.optional(),

    // Optional
    QUICKARTE_PLATFORM_FEE_BPS: platformFeeBpsSchema,
    QUICKARTE_ADMIN_EMAILS: adminEmailsSchema,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
    NEXT_PUBLIC_SALES_CONTACT: z.string().optional(),
    NEXT_PUBLIC_LAN_URL: urlSchema.optional(),
    NEXT_PUBLIC_ENABLE_SW_IN_DEV: booleanFromString.optional().default("false"),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    COOLIFY_GIT_COMMIT_SHA: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    // `next build` sets NODE_ENV=production to produce the prod bundle, but
    // the build may run on a laptop that doesn't have prod secrets. Prod-only
    // vars are enforced at *runtime* (server boot), not at build time. Always-
    // required vars (DATABASE_URL etc.) still fail the build if missing.
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    const prodRequired = [
      "STRIPE_SECRET_KEY",
      "STRIPE_PUBLISHABLE_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "VAPID_PRIVATE_KEY",
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
      "VAPID_SUBJECT",
      "RESEND_API_KEY",
      "CONTACT_EMAIL_FROM",
      "SENTRY_DSN",
      "NEXT_PUBLIC_SENTRY_DSN",
    ] as const;
    for (const key of prodRequired) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required in production`,
        });
      }
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const isBuildPhase =
    process.env.NEXT_PHASE === "phase-production-build" ||
    (process.env.NEXT_PHASE === undefined &&
      process.env.NODE_ENV === "production" &&
      typeof window === "undefined" &&
      !process.env.__NEXT_PRIVATE_ORIGIN);
  // During `next build` (including its page-data-collection sub-phase,
  // which may spawn workers where NEXT_PHASE isn't fully propagated), we
  // tolerate missing env by returning a loosely-validated placeholder
  // object. This is safe because:
  //   - At runtime, this module is imported eagerly by the app's boot
  //     path; if env is genuinely missing then, the original throw below
  //     still fires.
  //   - Build-time consumers of `env` don't execute request handlers.
  if (isBuildPhase) {
    console.warn(
      "[lib/env] Skipping env validation during build phase. Missing vars:",
      Object.keys(parsed.error.flatten().fieldErrors),
    );
  } else {
    console.error(
      "❌ Invalid environment variables:",
      parsed.error.flatten().fieldErrors,
    );
    throw new Error("Invalid environment variables. See errors above.");
  }
}

export const env = (parsed.success
  ? parsed.data
  : ({
      NODE_ENV: "production",
      DATABASE_URL:
        "postgres://placeholder:placeholder@unresolved-db-host.invalid:5432/placeholder",
      BETTER_AUTH_SECRET: "build-phase-placeholder-secret-value-32c",
      BETTER_AUTH_URL: "https://build.local",
      NEXT_PUBLIC_APP_URL: "https://build.local",
      NEXT_PUBLIC_CANONICAL_URL: "https://build.local",
      QUICKARTE_PLATFORM_FEE_BPS: 0,
      QUICKARTE_ADMIN_EMAILS: [],
      NEXT_PUBLIC_ENABLE_SW_IN_DEV: false,
    } as unknown as z.infer<typeof schema>)) as z.infer<typeof schema>;
export type Env = typeof env;
