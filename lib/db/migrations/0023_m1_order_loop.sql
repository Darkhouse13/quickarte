-- M1: core order loop — served/paid statuses, glovo channel, payment method, KDS prep
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction in PG < 12.
-- This project targets PG 14+ so each breakpoint runs safely in its own statement.

ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'served';
--> statement-breakpoint
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'paid';
--> statement-breakpoint
ALTER TYPE "order_type" ADD VALUE IF NOT EXISTS 'glovo';
--> statement-breakpoint
CREATE TYPE "order_payment_method" AS ENUM ('cash', 'card', 'glovo');
--> statement-breakpoint
CREATE TYPE "item_prep_status" AS ENUM ('queued', 'preparing', 'ready');
--> statement-breakpoint

-- orders: who confirmed + which payment method was used at the POS
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" order_payment_method;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirmed_by_user_id" uuid;
--> statement-breakpoint

-- order_items: per-item prep tracking for KDS
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "prep_status" item_prep_status NOT NULL DEFAULT 'queued';
--> statement-breakpoint

-- products: manager-set display order on the KDS
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "prep_priority" integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- Composite index used by garcon and POS polling queries
CREATE INDEX IF NOT EXISTS "orders_business_status_created_idx"
  ON "orders"("business_id", "status", "created_at");
