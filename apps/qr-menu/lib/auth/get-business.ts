import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  businesses,
  staffMembers,
  type Business,
  type BusinessSettings,
} from "@/lib/db/schema";
import { auth, type AuthSession } from "./server";

export type BusinessWithSettings = Business & {
  settings: BusinessSettings | null;
};

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
  business: BusinessWithSettings | null;
} | null> {
  const session = await getSession();
  if (!session) return null;
  const membership = await db.query.staffMembers.findFirst({
    where: and(
      eq(staffMembers.userId, session.user.id),
      isNull(staffMembers.revokedAt),
    ),
    columns: { businessId: true },
  });
  const business = await db.query.businesses.findFirst({
    where: membership
      ? eq(businesses.id, membership.businessId)
      : eq(businesses.ownerId, session.user.id),
    with: { settings: true },
  });
  return { session, business: business ?? null };
}

export async function requireBusiness(): Promise<{
  session: CurrentSession;
  business: BusinessWithSettings;
}> {
  const session = await requireSession();
  const membership = await db.query.staffMembers.findFirst({
    where: and(
      eq(staffMembers.userId, session.user.id),
      isNull(staffMembers.revokedAt),
    ),
    columns: { businessId: true },
  });
  const business = await db.query.businesses.findFirst({
    where: membership
      ? eq(businesses.id, membership.businessId)
      : eq(businesses.ownerId, session.user.id),
    with: { settings: true },
  });
  if (!business) redirect("/onboarding");
  return { session, business };
}
