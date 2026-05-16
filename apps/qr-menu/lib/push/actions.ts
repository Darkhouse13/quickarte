"use server";

import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { requireBusiness } from "@/lib/auth/get-business";
import { hasEntitlement } from "@/lib/entitlements/queries";
import type { PushSubscriptionInput } from "./types";

export type SubscribeResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function subscribeToPush(
  input: PushSubscriptionInput,
): Promise<SubscribeResult> {
  const { session, business } = await requireBusiness();

  const ok = await hasEntitlement(business.id, "online_ordering");
  if (!ok) {
    return {
      status: "error",
      message: "Module commandes en ligne requis.",
    };
  }

  if (!input.endpoint || !input.keys?.p256dh || !input.keys?.auth) {
    return { status: "error", message: "Abonnement invalide." };
  }

  const ua =
    input.userAgent ??
    (await headers()).get("user-agent") ??
    null;

  // Upsert by endpoint — a re-subscribe from the same device replaces the
  // previous row, which carries over any stored failure counters.
  await db
    .insert(pushSubscriptions)
    .values({
      businessId: business.id,
      userId: session.user.id,
      endpoint: input.endpoint,
      p256dhKey: input.keys.p256dh,
      authKey: input.keys.auth,
      userAgent: ua,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        businessId: business.id,
        userId: session.user.id,
        p256dhKey: input.keys.p256dh,
        authKey: input.keys.auth,
        userAgent: ua,
        failureCount: 0,
        updatedAt: new Date(),
      },
    });

  return { status: "ok" };
}

export async function unsubscribeFromPush(
  endpoint: string,
): Promise<SubscribeResult> {
  if (!endpoint) return { status: "error", message: "Endpoint manquant." };
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
  return { status: "ok" };
}

export async function getSubscriptionCount(): Promise<number> {
  const { business } = await requireBusiness();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.businessId, business.id));
  return row?.count ?? 0;
}
