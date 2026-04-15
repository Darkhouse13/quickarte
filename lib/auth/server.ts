import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import {
  accounts,
  sessions,
  users,
  verifications,
} from "@/lib/db/schema";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const trustedOrigins = Array.from(
  new Set(
    [
      appUrl,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      process.env.NEXT_PUBLIC_LAN_URL,
    ].filter((v): v is string => Boolean(v)),
  ),
);

export const auth = betterAuth({
  basePath: "/api/auth",
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
});

export type AuthSession = typeof auth.$Infer.Session;
