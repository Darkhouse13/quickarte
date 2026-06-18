/**
 * Generates one QR code per Mizane dine-in table.
 *
 * Consumes Mizane's GET /tables and, for each table, writes a PNG that
 * deep-links the QuickArte storefront with the table's Mizane UUID (`?t=`) and
 * label (`?tl=`). Scanning it starts a dine-in order bound to that exact table,
 * which is forwarded to Mizane as `tableId` on POST /orders.
 *
 * Run: npx tsx --env-file=.env --require ./scripts/mock-server-only.cjs \
 *        scripts/mizane-table-qr.ts
 *
 * Env: MIZANE_INTEGRATION_KEY (required); QR_BASE_URL / NEXT_PUBLIC_APP_URL
 *      (storefront origin, default http://localhost:3000); QR_SLUG / QR_LOCALE
 *      (override the business slug/locale; defaults read from the first business).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";
import { getMizaneTables } from "../lib/integrations/mizane/client";
import { db } from "../lib/db";
import { businesses } from "../lib/db/schema";

const OUT_DIR = join(process.cwd(), "table-qr");

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "table";
}

async function resolveStorefront(): Promise<{ slug: string; locale: string }> {
  const slugOverride = process.env.QR_SLUG;
  const localeOverride = process.env.QR_LOCALE;
  if (slugOverride) {
    return { slug: slugOverride, locale: localeOverride ?? "fr" };
  }
  const [row] = await db
    .select({ slug: businesses.slug, locale: businesses.locale })
    .from(businesses)
    .limit(1);
  if (!row) throw new Error("No business found (set QR_SLUG to skip the DB).");
  return {
    slug: row.slug,
    locale: localeOverride ?? row.locale.split("-")[0] ?? "fr",
  };
}

async function main() {
  const apiKey = process.env.MIZANE_INTEGRATION_KEY;
  if (!apiKey) throw new Error("Set MIZANE_INTEGRATION_KEY in .env");

  const base = (
    process.env.QR_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");

  const tables = await getMizaneTables(apiKey);
  if (tables.length === 0) {
    console.log(
      "Mizane returned no dine-in tables (GET /tables is empty). Nothing to generate.",
    );
    process.exit(0);
  }

  const { slug, locale } = await resolveStorefront();
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Storefront: ${base}/${locale}/${slug}`);
  console.log(`Tables: ${tables.length} → writing QR PNGs to ${OUT_DIR}\n`);

  for (const table of tables) {
    const url = `${base}/${locale}/${slug}?t=${encodeURIComponent(
      table.id,
    )}&tl=${encodeURIComponent(table.name)}`;
    const file = join(OUT_DIR, `${sanitizeFilename(table.name)}.png`);
    await QRCode.toFile(file, url, { margin: 2, width: 512 });
    const room = table.room ? ` (${table.room})` : "";
    console.log(`  ${table.name}${room}`);
    console.log(`    ${url}`);
    console.log(`    → ${file}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
