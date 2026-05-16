import "server-only";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { businessEntitlements } from "@/lib/db/schema";
import { MODULE_KEYS, type ModuleKey } from "./types";

export async function hasEntitlement(
  businessId: string,
  module: ModuleKey,
): Promise<boolean> {
  try {
    const row = await db.query.businessEntitlements.findFirst({
      where: and(
        eq(businessEntitlements.businessId, businessId),
        eq(businessEntitlements.module, module),
        eq(businessEntitlements.enabled, true),
        or(
          isNull(businessEntitlements.validUntil),
          gt(businessEntitlements.validUntil, new Date()),
        ),
      ),
      columns: { businessId: true },
    });
    return Boolean(row);
  } catch (err) {
    console.error(
      `[entitlements] hasEntitlement(${businessId}, ${module}) failed:`,
      err,
    );
    return false;
  }
}

export async function getEntitlements(
  businessId: string,
): Promise<Record<ModuleKey, boolean>> {
  const rows = await db.query.businessEntitlements.findMany({
    where: eq(businessEntitlements.businessId, businessId),
  });
  const now = Date.now();
  const map = Object.fromEntries(
    MODULE_KEYS.map((m) => [m, false] as const),
  ) as Record<ModuleKey, boolean>;
  for (const row of rows) {
    const active =
      row.enabled &&
      (row.validUntil === null || row.validUntil.getTime() > now);
    map[row.module] = active;
  }
  return map;
}

export class EntitlementRequiredError extends Error {
  readonly module: ModuleKey;
  readonly businessId: string;
  constructor(businessId: string, module: ModuleKey) {
    super(`Business ${businessId} is not entitled to module ${module}`);
    this.name = "EntitlementRequiredError";
    this.module = module;
    this.businessId = businessId;
  }
}

export async function requireEntitlement(
  businessId: string,
  module: ModuleKey,
): Promise<void> {
  const ok = await hasEntitlement(businessId, module);
  if (!ok) throw new EntitlementRequiredError(businessId, module);
}
