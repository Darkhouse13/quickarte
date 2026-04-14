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

export const auth = betterAuth({
  basePath: "/api/auth",
  trustedOrigins: [appUrl],
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
