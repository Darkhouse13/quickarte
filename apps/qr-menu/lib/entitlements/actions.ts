"use server";

import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { businessEntitlements } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/get-business";
import type { EntitlementSource, ModuleKey } from "./types";

type GrantOptions = {
  planTier?: string | null;
  validUntil?: Date | null;
  source?: EntitlementSource;
};

async function requireAdmin(): Promise<void> {
  const session = await requireSession();
  const adminEmails = env.QUICKARTE_ADMIN_EMAILS;
  const email = session.user.email?.toLowerCase();
  if (!email || !adminEmails.includes(email)) {
    throw new Error("Forbidden: admin access required");
  }
}

export async function grantEntitlement(
  businessId: string,
  module: ModuleKey,
  options: GrantOptions = {},
): Promise<void> {
  await requireAdmin();
  const { planTier = null, validUntil = null, source = "manual" } = options;
  await db
    .insert(businessEntitlements)
    .values({
      businessId,
      module,
      enabled: true,
      planTier,
      validUntil,
      source,
    })
    .onConflictDoUpdate({
      target: [businessEntitlements.businessId, businessEntitlements.module],
      set: {
        enabled: true,
        planTier,
        validUntil,
        source,
        updatedAt: new Date(),
      },
    });
}

export async function revokeEntitlement(
  businessId: string,
  module: ModuleKey,
): Promise<void> {
  await requireAdmin();
  await db
    .update(businessEntitlements)
    .set({ enabled: false, updatedAt: new Date() })
    .where(
      and(
        eq(businessEntitlements.businessId, businessId),
        eq(businessEntitlements.module, module),
      ),
    );
}
