import { db } from "@/lib/db";
import { mizaneIntegrations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { MizaneIntegration } from "@/lib/db/schema/integrations";

export async function getMizaneIntegration(
  businessId: string,
): Promise<MizaneIntegration | null> {
  const [row] = await db
    .select()
    .from(mizaneIntegrations)
    .where(eq(mizaneIntegrations.businessId, businessId))
    .limit(1);
  return row ?? null;
}

export async function upsertMizaneIntegration(
  businessId: string,
  apiKey: string,
): Promise<void> {
  await db
    .insert(mizaneIntegrations)
    .values({ businessId, apiKey })
    .onConflictDoUpdate({
      target: mizaneIntegrations.businessId,
      set: { apiKey, updatedAt: new Date() },
    });
}

export async function touchMizaneLastSynced(businessId: string): Promise<void> {
  await db
    .update(mizaneIntegrations)
    .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(mizaneIntegrations.businessId, businessId));
}

export async function deleteMizaneIntegration(businessId: string): Promise<void> {
  await db
    .delete(mizaneIntegrations)
    .where(eq(mizaneIntegrations.businessId, businessId));
}
