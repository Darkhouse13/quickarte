import { config } from "dotenv";
config({ path: ".env" });

type Verb = "test" | "list" | "vapid";

function usage(): never {
  console.error("Usage:");
  console.error("  npm run push -- test <slug>");
  console.error("  npm run push -- list <slug>");
  console.error("  npm run push -- vapid");
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  const verb = argv[0] as Verb | undefined;

  if (!verb) usage();

  if (verb === "vapid") {
    const webpush = (await import("web-push")).default;
    const keys = webpush.generateVAPIDKeys();
    console.log("Generated VAPID keys — paste into your .env:\n");
    console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
    console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
    console.log(`VAPID_SUBJECT=mailto:contact@quickarte.fr`);
    return;
  }

  if (verb !== "test" && verb !== "list") usage();

  const slug = argv[1];
  if (!slug) usage();

  const { eq } = await import("drizzle-orm");
  const { db, pool } = await import("../lib/db");
  const { businesses } = await import("../lib/db/schema");
  const { getSubscriptionsForBusiness } = await import("../lib/push/queries");

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
      const subs = await getSubscriptionsForBusiness(business.id);
      console.log(`${business.name} (${business.slug}) — ${subs.length} subscription(s)`);
      if (subs.length === 0) {
        console.log("  No push subscriptions yet.");
        return;
      }
      for (const s of subs) {
        const last = s.lastSuccessAt
          ? s.lastSuccessAt.toISOString()
          : "never";
        const ua = (s.userAgent ?? "unknown").slice(0, 60);
        console.log(
          `  ${s.id.slice(0, 8)}  fails=${s.failureCount}  last=${last}  ${ua}`,
        );
      }
      return;
    }

    // verb === "test"
    const { sendTestNotification } = await import("../lib/push/send");
    const result = await sendTestNotification(business.id);
    console.log(
      `✓ ${business.name}: delivered=${result.delivered} removed=${result.removed} failed=${result.failed}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ Failed:", err);
  process.exitCode = 1;
});
