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

/**
 * Records a successful menu sync: stamps lastSyncedAt and caches the response
 * ETag so the next sync can send If-None-Match and short-circuit on 304. Pass
 * the etag through unchanged on a 304 (it's stable while the menu is).
 */
export async function markMizaneMenuSynced(
  businessId: string,
  menuEtag: string | null,
): Promise<void> {
  const now = new Date();
  await db
    .update(mizaneIntegrations)
    .set({ lastSyncedAt: now, menuEtag, updatedAt: now })
    .where(eq(mizaneIntegrations.businessId, businessId));
}

export async function getMizaneMenuEtag(
  businessId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ menuEtag: mizaneIntegrations.menuEtag })
    .from(mizaneIntegrations)
    .where(eq(mizaneIntegrations.businessId, businessId))
    .limit(1);
  return row?.menuEtag ?? null;
}

export async function deleteMizaneIntegration(businessId: string): Promise<void> {
  await db
    .delete(mizaneIntegrations)
    .where(eq(mizaneIntegrations.businessId, businessId));
}
