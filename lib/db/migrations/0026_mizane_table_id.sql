-- 0026: store the Mizane dine-in table UUID on each order (per-table QR ordering)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "mizane_table_id" uuid;
