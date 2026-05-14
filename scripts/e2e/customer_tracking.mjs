// E2E: customer order tracking page (/[locale]/o/[token]).
//
// Seeds a dine-in order straight into the DB (the customer token is never
// surfaced in merchant UI), lands on /fr/o/<token>, asserts the calm hero +
// table number + WhatsApp link, then flips the order to `preparing` and waits
// for the 10s poll to swap the status word to "En préparation".
//
// Requires: dev server on localhost:3000 + DATABASE_URL reachable.
//   node scripts/e2e/customer_tracking.mjs

import "dotenv/config";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { launch, BASE, dump } from "./helpers.mjs";

const TABLE_NUMBER = "12";
const TEST_WHATSAPP = "+212612345678";
const token = randomBytes(24).toString("base64url");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let orderId = null;
let restoreWhatsapp = null; // { settingsId, previous }

async function cleanup() {
  try {
    if (orderId) await client.query("DELETE FROM orders WHERE id = $1", [orderId]);
    if (restoreWhatsapp) {
      await client.query(
        "UPDATE business_settings SET whatsapp_number = $1 WHERE id = $2",
        [restoreWhatsapp.previous, restoreWhatsapp.settingsId],
      );
    }
  } catch (err) {
    console.error("[cleanup]", err.message);
  }
  await client.end();
}

try {
  const biz = await client.query(
    "SELECT id, name FROM businesses ORDER BY created_at LIMIT 1",
  );
  if (biz.rowCount === 0) throw new Error("no businesses in DB — run npm run db:seed");
  const businessId = biz.rows[0].id;

  const product = await client.query(
    "SELECT id, name, price FROM products WHERE business_id = $1 LIMIT 1",
    [businessId],
  );
  if (product.rowCount === 0) throw new Error("no products for seed business");
  const { id: productId, price: unitPrice } = product.rows[0];

  // Ensure the WhatsApp contact strip has something to render.
  const settings = await client.query(
    "SELECT id, whatsapp_number FROM business_settings WHERE business_id = $1 LIMIT 1",
    [businessId],
  );
  if (settings.rowCount > 0) {
    restoreWhatsapp = {
      settingsId: settings.rows[0].id,
      previous: settings.rows[0].whatsapp_number,
    };
    await client.query(
      "UPDATE business_settings SET whatsapp_number = $1 WHERE id = $2",
      [TEST_WHATSAPP, settings.rows[0].id],
    );
  }

  const inserted = await client.query(
    `INSERT INTO orders
       (business_id, customer_name, customer_access_token, type, status, total, table_number)
     VALUES ($1, 'E2E Tracking', $2, 'dine_in', 'confirmed', $3, $4)
     RETURNING id`,
    [businessId, token, unitPrice, TABLE_NUMBER],
  );
  orderId = inserted.rows[0].id;

  await client.query(
    `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
     VALUES ($1, $2, 1, $3, $3)`,
    [orderId, productId, unitPrice],
  );
  await client.query(
    "INSERT INTO order_events (order_id, event_type, actor_role) VALUES ($1, 'order.created', 'customer')",
    [orderId],
  );

  dump("seeded", { orderId, token });

  const browser = await launch();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  await page.goto(`${BASE}/fr/o/${token}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => /Reçue/.test(document.body.innerText));

  const landed = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const hasTable = /N°\s*12/.test(landed);
  const hasWhatsapp = /WhatsApp/i.test(landed);
  dump("landed", { hasReçue: /Reçue/.test(landed), hasTable, hasWhatsapp });
  if (!hasTable) throw new Error("table number N° 12 not rendered");
  if (!hasWhatsapp) throw new Error("WhatsApp contact strip not rendered");

  // Advance the order; the page polls /api/orders/<token>/status every 10s.
  await client.query("UPDATE orders SET status = 'preparing' WHERE id = $1", [orderId]);
  await client.query(
    "INSERT INTO order_events (order_id, event_type, actor_role) VALUES ($1, 'order.preparing', 'kitchen')",
    [orderId],
  );
  dump("phase", "status flipped to preparing — waiting for poll");

  await page.waitForFunction(
    () => /En préparation/.test(document.body.innerText),
    { timeout: 20000 },
  );
  dump("polled", { hasEnPréparation: true });

  await browser.close();
  dump("RESULT", "PASS");
  await cleanup();
  process.exit(0);
} catch (err) {
  console.error("[fatal]", err.message);
  dump("RESULT", "FAIL");
  await cleanup();
  process.exit(1);
}
