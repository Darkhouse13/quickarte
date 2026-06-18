-- 0024: store the Mizane POS order id on each posted order (Phase 1 status polling)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "mizane_order_id" text;
--> statement-breakpoint
-- Polling query filters on mizane_order_id IS NOT NULL + status = 'pending'
CREATE INDEX IF NOT EXISTS "orders_mizane_order_id_idx" ON "orders"("mizane_order_id");
