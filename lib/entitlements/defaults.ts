import "server-only";
import { db } from "@/lib/db";
import { businessEntitlements } from "@/lib/db/schema";

export async function provisionDefaultEntitlements(
  businessId: string,
): Promise<void> {
  await db
    .insert(businessEntitlements)
    .values({
      businessId,
      module: "menu_qr",
      enabled: true,
      source: "grandfathered",
    })
    .onConflictDoNothing({
      target: [businessEntitlements.businessId, businessEntitlements.module],
    });
}
