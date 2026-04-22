import { config } from "dotenv";
config({ path: ".env" });

type Verb = "status" | "sync";

function usage(): never {
  console.error("Usage:");
  console.error("  npm run stripe -- status <slug>");
  console.error("  npm run stripe -- sync <slug>");
  process.exit(1);
}

async function main() {
  const [verb, slug] = process.argv.slice(2) as [Verb | undefined, string?];
  if (!verb || !slug) usage();
  if (verb !== "status" && verb !== "sync") usage();

  const { eq } = await import("drizzle-orm");
  const { db, pool } = await import("../lib/db");
  const { businesses } = await import("../lib/db/schema");
  const { getConnectStatus, syncAccountStatus } = await import(
    "../lib/payments"
  );

  try {
    const business = await db.query.businesses.findFirst({
      where: eq(businesses.slug, slug),
      columns: {
        id: true,
        name: true,
        slug: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeOnboardingCompletedAt: true,
      },
    });
    if (!business) {
      console.error(`✗ No business with slug "${slug}"`);
      process.exit(2);
    }

    if (verb === "status") {
      const status = await getConnectStatus(business.id);
      printBusiness(business);
      printStatus(status);
      return;
    }

    if (verb === "sync") {
      console.log(`→ Syncing Stripe status for ${business.slug}…`);
      const status = await syncAccountStatus(business.id);
      console.log("✓ Synced.");
      printStatus(status);
      return;
    }
  } finally {
    await pool.end();
  }
}

function printBusiness(b: {
  name: string;
  slug: string;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeOnboardingCompletedAt: Date | null;
}) {
  console.log(`${b.name} (${b.slug})`);
  console.log(`  cached → account_id: ${b.stripeAccountId ?? "—"}`);
  console.log(`  cached → charges_enabled: ${b.stripeChargesEnabled}`);
  console.log(`  cached → payouts_enabled: ${b.stripePayoutsEnabled}`);
  console.log(
    `  cached → onboarding_completed_at: ${
      b.stripeOnboardingCompletedAt?.toISOString() ?? "—"
    }`,
  );
}

function printStatus(status: {
  state: string;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  completedAt?: Date | null;
}) {
  console.log(`  live → state: ${status.state}`);
  if (status.accountId) console.log(`  live → account_id: ${status.accountId}`);
  if (typeof status.chargesEnabled === "boolean") {
    console.log(`  live → charges_enabled: ${status.chargesEnabled}`);
  }
  if (typeof status.payoutsEnabled === "boolean") {
    console.log(`  live → payouts_enabled: ${status.payoutsEnabled}`);
  }
}

main().catch((err) => {
  console.error("✗ Failed:", err);
  process.exitCode = 1;
});
