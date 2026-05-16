import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions, type PushSubscriptionRow } from "@/lib/db/schema";

export async function getSubscriptionsForBusiness(
  businessId: string,
): Promise<PushSubscriptionRow[]> {
  return db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.businessId, businessId),
  });
}

export async function markSuccess(subscriptionId: string): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ lastSuccessAt: new Date(), failureCount: 0, updatedAt: new Date() })
    .where(eq(pushSubscriptions.id, subscriptionId));
}

export async function markFailure(subscriptionId: string): Promise<number> {
  const [row] = await db
    .update(pushSubscriptions)
    .set({
      failureCount: sql`${pushSubscriptions.failureCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(pushSubscriptions.id, subscriptionId))
    .returning({ failureCount: pushSubscriptions.failureCount });
  return row?.failureCount ?? 0;
}

export async function deleteSubscription(id: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
}

export async function deleteSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}
