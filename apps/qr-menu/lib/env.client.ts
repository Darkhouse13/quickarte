import { z } from "zod";

// Next.js inlines `process.env.NEXT_PUBLIC_*` at build time via static string
// replacement, so each var must be referenced by its literal name below — not
// accessed dynamically. Nothing in this file may read a non-NEXT_PUBLIC_ var.
const raw = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_CANONICAL_URL: process.env.NEXT_PUBLIC_CANONICAL_URL,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  NEXT_PUBLIC_SALES_CONTACT: process.env.NEXT_PUBLIC_SALES_CONTACT,
  NEXT_PUBLIC_LAN_URL: process.env.NEXT_PUBLIC_LAN_URL,
  NEXT_PUBLIC_ENABLE_SW_IN_DEV: process.env.NEXT_PUBLIC_ENABLE_SW_IN_DEV,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
};

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_CANONICAL_URL: z.string().url(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  NEXT_PUBLIC_SALES_CONTACT: z.string().optional(),
  NEXT_PUBLIC_LAN_URL: z.string().url().optional(),
  NEXT_PUBLIC_ENABLE_SW_IN_DEV: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

const parsed = schema.safeParse(raw);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    "❌ Invalid client environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid client environment variables. See errors above.");
}

export const clientEnv = parsed.data;
export type ClientEnv = typeof clientEnv;
