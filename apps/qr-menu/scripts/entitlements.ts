import { config } from "dotenv";
config({ path: ".env" });

type Verb = "grant" | "revoke" | "list";

function usage(): never {
  console.error("Usage:");
  console.error("  npm run entitlements -- grant <slug> <module>");
  console.error("  npm run entitlements -- revoke <slug> <module>");
  console.error("  npm run entitlements -- list <slug>");
  console.error("");
  console.error(
    "  <module> ∈ {menu_qr | online_ordering | loyalty | analytics}",
  );
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  const verb = argv[0] as Verb | undefined;
  const slug = argv[1];
  const moduleArg = argv[2];

  if (!verb || !slug) usage();
  if ((verb === "grant" || verb === "revoke") && !moduleArg) usage();
  if (verb !== "grant" && verb !== "revoke" && verb !== "list") usage();

  const { eq, and } = await import("drizzle-orm");
  const { db, pool } = await import("../lib/db");
  const { businesses, businessEntitlements } = await import(
    "../lib/db/schema"
  );
  const { isModuleKey, MODULE_KEYS } = await import(
    "../lib/entitlements/types"
  );

  try {
    const business = await db.query.businesses.findFirst({
      where: eq(businesses.slug, slug),
      columns: { id: true, name: true, slug: true },
    });
    if (!business) {
      console.error(`✗ No business with slug "${slug}"`);
      process.exit(2);
    }

    if (verb === "list") {
      const rows = await db.query.businessEntitlements.findMany({
        where: eq(businessEntitlements.businessId, business.id),
      });
      const map = new Map(rows.map((r) => [r.module, r] as const));
      console.log(`${business.name} (${business.slug})`);
      const now = Date.now();
      for (const m of MODULE_KEYS) {
        const row = map.get(m);
        if (!row) {
          console.log(`  ${m.padEnd(18)} —  (no row, implicit off)`);
          continue;
        }
        const expired =
          row.validUntil !== null && row.validUntil.getTime() <= now;
        const active = row.enabled && !expired;
        const marker = active ? "✓" : "·";
        const expiry = row.validUntil
          ? ` until ${row.validUntil.toISOString()}`
          : "";
        const tier = row.planTier ? ` [${row.planTier}]` : "";
        console.log(
          `  ${marker} ${m.padEnd(18)} ${row.source}${tier}${expiry}`,
        );
      }
      return;
    }

    if (!moduleArg || !isModuleKey(moduleArg)) {
      console.error(
        `✗ Invalid module "${moduleArg}". Expected one of: ${MODULE_KEYS.join(", ")}`,
      );
      process.exit(3);
    }

    if (verb === "grant") {
      await db
        .insert(businessEntitlements)
        .values({
          businessId: business.id,
          module: moduleArg,
          enabled: true,
          source: "manual",
        })
        .onConflictDoUpdate({
          target: [
            businessEntitlements.businessId,
            businessEntitlements.module,
          ],
          set: {
            enabled: true,
            source: "manual",
            updatedAt: new Date(),
          },
        });
      console.log(`✓ Granted ${moduleArg} to ${business.slug}`);
      return;
    }

    if (verb === "revoke") {
      await db
        .update(businessEntitlements)
        .set({ enabled: false, updatedAt: new Date() })
        .where(
          and(
            eq(businessEntitlements.businessId, business.id),
            eq(businessEntitlements.module, moduleArg),
          ),
        );
      console.log(`✓ Revoked ${moduleArg} from ${business.slug}`);
      return;
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ Failed:", err);
  process.exitCode = 1;
});
