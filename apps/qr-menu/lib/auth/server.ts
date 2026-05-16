import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  accounts,
  sessions,
  users,
  verifications,
} from "@/lib/db/schema";

const trustedOrigins = Array.from(
  new Set(
    [
      env.NEXT_PUBLIC_APP_URL,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      env.NEXT_PUBLIC_LAN_URL,
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
