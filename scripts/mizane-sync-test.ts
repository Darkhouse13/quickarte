import { syncMizaneMenu } from "../lib/integrations/mizane/sync-menu";
import { db } from "../lib/db";
import { businesses } from "../lib/db/schema";

async function main() {
  const rows = await db
    .select({ id: businesses.id, name: businesses.name })
    .from(businesses)
    .limit(1);

  if (!rows.length) {
    console.error("No business found");
    process.exit(1);
  }

  const { id, name } = rows[0]!;
  console.log("Syncing for business:", name, id);

  const apiKey = process.env.MIZANE_INTEGRATION_KEY;
  if (!apiKey) throw new Error("Set MIZANE_INTEGRATION_KEY in .env");
  const result = await syncMizaneMenu(id, apiKey);
  console.log("Sync result:", JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
