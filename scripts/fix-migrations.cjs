const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    const j = await c.query("SELECT created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at");
    console.log("drizzle migrations recorded:", j.rows.length);
  } catch (e) { console.log("no drizzle migrations table:", e.message); }
  const before = await c.query("SELECT table_name || '.' || column_name AS col FROM information_schema.columns WHERE table_name IN ('product_variants','product_options','option_values') AND column_name IN ('position','max_selections') ORDER BY 1");
  console.log("BEFORE position/max_selections:", before.rows.map(r => r.col));
  try {
    const bt = await c.query("SELECT unnest(enum_range(NULL::business_type))::text AS v");
    console.log("business_type enum:", bt.rows.map(r => r.v));
  } catch (e) { console.log("business_type read failed:", e.message); }
  try {
    const os = await c.query("SELECT unnest(enum_range(NULL::order_status))::text AS v");
    console.log("order_status enum:", os.rows.map(r => r.v));
  } catch (e) { console.log("order_status read failed:", e.message); }
  for (const sql of [
    'ALTER TABLE "option_values" ADD COLUMN IF NOT EXISTS "position" integer DEFAULT 0 NOT NULL',
    'ALTER TABLE "product_options" ADD COLUMN IF NOT EXISTS "position" integer DEFAULT 0 NOT NULL',
    'ALTER TABLE "product_options" ADD COLUMN IF NOT EXISTS "max_selections" integer',
    'ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "position" integer DEFAULT 0 NOT NULL',
  ]) { await c.query(sql); console.log("applied:", sql); }
  for (const v of ["preparing", "ready"]) {
    await c.query("ALTER TYPE order_status ADD VALUE IF NOT EXISTS '" + v + "'");
    console.log("applied:", "ALTER TYPE order_status ADD VALUE IF NOT EXISTS '" + v + "'");
  }
  const after = await c.query("SELECT table_name || '.' || column_name AS col FROM information_schema.columns WHERE table_name IN ('product_variants','product_options','option_values') AND column_name IN ('position','max_selections') ORDER BY 1");
  console.log("AFTER position/max_selections:", after.rows.map(r => r.col));
  const os2 = await c.query("SELECT unnest(enum_range(NULL::order_status))::text AS v");
  console.log("AFTER order_status enum:", os2.rows.map(r => r.v));
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
