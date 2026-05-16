import { createAuthClient } from "better-auth/client";
import { clientEnv } from "@/lib/env.client";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : clientEnv.NEXT_PUBLIC_APP_URL,
});

export const { signIn, signUp, signOut, useSession } = authClient;
