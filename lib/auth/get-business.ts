import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses, type Business } from "@/lib/db/schema";
import { auth, type AuthSession } from "./server";

export type CurrentSession = AuthSession;

export async function getSession(): Promise<CurrentSession | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ?? null;
}

export async function requireSession(): Promise<CurrentSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function getCurrentBusiness(): Promise<{
  session: CurrentSession;
  business: Business | null;
} | null> {
  const session = await getSession();
  if (!session) return null;
  const business = await db.query.businesses.findFirst({
    where: eq(businesses.ownerId, session.user.id),
  });
  return { session, business: business ?? null };
}

export async function requireBusiness(): Promise<{
  session: CurrentSession;
  business: Business;
}> {
  const session = await requireSession();
  const business = await db.query.businesses.findFirst({
    where: eq(businesses.ownerId, session.user.id),
  });
  if (!business) redirect("/onboarding");
  return { session, business };
}
