import { isNotNull } from "drizzle-orm";
import { db } from "../lib/db";
import { products } from "../lib/db/schema";
import { upsertMizaneIntegration, getMizaneIntegration } from "../lib/integrations/mizane/queries";

async function main() {
  const apiKey = process.env.MIZANE_INTEGRATION_KEY;
  if (!apiKey) throw new Error("Set MIZANE_INTEGRATION_KEY in .env");
  // The business that owns the synced (mizane_id-bearing) products.
  const synced = await db
    .select({ businessId: products.businessId })
    .from(products)
    .where(isNotNull(products.mizaneId))
    .limit(1);

  if (synced.length === 0) {
    throw new Error("No synced products found — run the menu sync first.");
  }
  const businessId = synced[0]!.businessId;
  console.log("Business owning synced catalog:", businessId);

  const existing = await getMizaneIntegration(businessId);
  if (existing) {
    console.log("Integration already present (lastSyncedAt:", existing.lastSyncedAt, ")");
  } else {
    await upsertMizaneIntegration(businessId, apiKey);
    console.log("Created mizane_integrations row for business.");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
