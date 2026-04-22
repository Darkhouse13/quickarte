import { config } from "dotenv";
config({ path: ".env" });

type Verb = "accrue" | "redeem" | "list";

function usage(): never {
  console.error("Usage:");
  console.error("  npm run loyalty -- accrue <slug> <phone> [amount]");
  console.error("  npm run loyalty -- redeem <slug> <phone>");
  console.error("  npm run loyalty -- list <slug>");
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  const verb = argv[0] as Verb | undefined;
  const slug = argv[1];

  if (!verb || !slug) usage();
  if (verb !== "accrue" && verb !== "redeem" && verb !== "list") usage();

  const { eq, desc } = await import("drizzle-orm");
  const { db, pool } = await import("../lib/db");
  const {
    businesses,
    loyaltyCustomers,
    loyaltyPrograms,
  } = await import("../lib/db/schema");
  const { recordAccrual, recordRedemption } = await import(
    "../lib/loyalty/service"
  );
  const { normalizeFrenchPhone: normalizePhone, formatPhoneForDisplay } =
    await import("../lib/utils/phone");

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
      const program = await db.query.loyaltyPrograms.findFirst({
        where: eq(loyaltyPrograms.businessId, business.id),
      });
      console.log(`${business.name} (${business.slug})`);
      if (!program) {
        console.log(`  No program configured.`);
        return;
      }
      const threshold = Number(program.rewardThreshold);
      console.log(
        `  Program: ${program.name ?? "(unnamed)"} — ${program.accrualType} — threshold ${threshold} — reward: ${program.rewardDescription}${program.enabled ? "" : " (disabled)"}`,
      );
      const customers = await db
        .select()
        .from(loyaltyCustomers)
        .where(eq(loyaltyCustomers.businessId, business.id))
        .orderBy(desc(loyaltyCustomers.lastVisitAt))
        .limit(50);
      if (customers.length === 0) {
        console.log(`  No loyalty customers yet.`);
        return;
      }
      for (const c of customers) {
        const balance = Number(c.balance);
        const ready = balance >= threshold ? "🎉" : "  ";
        const lastVisit = c.lastVisitAt
          ? c.lastVisitAt.toISOString().slice(0, 10)
          : "—";
        console.log(
          `  ${ready} ${formatPhoneForDisplay(c.phone).padEnd(17)} ${(c.name ?? "").padEnd(14)} ${balance.toString().padStart(6)} / ${threshold}  ${lastVisit}`,
        );
      }
      return;
    }

    const rawPhone = argv[2];
    if (!rawPhone) usage();

    let phone: string;
    try {
      phone = normalizePhone(rawPhone);
    } catch (err) {
      console.error(
        `✗ Invalid phone: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(3);
    }

    if (verb === "accrue") {
      const amount = argv[3] ? Number(argv[3].replace(",", ".")) : undefined;
      const res = await recordAccrual({
        businessId: business.id,
        phone,
        amountSpent: amount,
        source: "manual_in_person",
        note: "CLI",
      });
      console.log(
        `✓ Accrued +${res.delta} — ${formatPhoneForDisplay(res.customer.phone)} — balance ${res.newBalance}/${res.threshold}${res.rewardReady ? " 🎉 reward ready" : ""}`,
      );
      return;
    }

    if (verb === "redeem") {
      const customer = await db.query.loyaltyCustomers.findFirst({
        where: eq(loyaltyCustomers.phone, phone),
      });
      if (!customer || customer.businessId !== business.id) {
        console.error(`✗ Customer ${phone} not found for ${slug}`);
        process.exit(4);
      }
      const res = await recordRedemption({
        businessId: business.id,
        customerId: customer.id,
        note: "CLI",
      });
      console.log(
        `✓ Redeemed — ${formatPhoneForDisplay(res.customer.phone)} — new balance ${res.newBalance}/${res.threshold}`,
      );
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
