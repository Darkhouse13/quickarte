DO $$ BEGIN
  CREATE TYPE "public"."stock_movement_type" AS ENUM(
    'sale_deduction',
    'adjustment',
    'receipt',
    'transfer_in',
    'transfer_out',
    'count_correction',
    'batch_production',
    'batch_consumption'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "branch_id" uuid NOT NULL REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action,
  "ingredient_id" uuid NOT NULL REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action,
  "quantity_delta" numeric(18, 4) NOT NULL,
  "movement_type" "public"."stock_movement_type" NOT NULL,
  "reason" text,
  "reference_type" varchar(64),
  "reference_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "stock_movements_quantity_delta_non_zero" CHECK ("quantity_delta" <> 0)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "stock_levels" (
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "branch_id" uuid NOT NULL REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action,
  "ingredient_id" uuid NOT NULL REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action,
  "current_qty" numeric(18, 4) DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "stock_levels_business_branch_ingredient_pk" PRIMARY KEY("business_id", "branch_id", "ingredient_id")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "stock_movements_business_branch_idx"
  ON "stock_movements" USING btree ("business_id", "branch_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_ingredient_idx"
  ON "stock_movements" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_reference_idx"
  ON "stock_movements" USING btree ("business_id", "reference_type", "reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_movements_sale_reference_ingredient_unique"
  ON "stock_movements" USING btree ("business_id", "reference_type", "reference_id", "ingredient_id")
  WHERE "movement_type" = 'sale_deduction'
    AND "reference_type" IS NOT NULL
    AND "reference_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_levels_branch_idx"
  ON "stock_levels" USING btree ("business_id", "branch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_levels_ingredient_idx"
  ON "stock_levels" USING btree ("ingredient_id");--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_stock_movements_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements is append-only; write a compensating movement instead';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS stock_movements_no_update ON stock_movements;--> statement-breakpoint
CREATE TRIGGER stock_movements_no_update
  BEFORE UPDATE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION prevent_stock_movements_mutation();--> statement-breakpoint
DROP TRIGGER IF EXISTS stock_movements_no_delete ON stock_movements;--> statement-breakpoint
CREATE TRIGGER stock_movements_no_delete
  BEFORE DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION prevent_stock_movements_mutation();--> statement-breakpoint

ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_movements" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "stock_movements_tenant_isolation" ON "stock_movements";--> statement-breakpoint
CREATE POLICY "stock_movements_tenant_isolation" ON "stock_movements"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "stock_levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_levels" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "stock_levels_tenant_isolation" ON "stock_levels";--> statement-breakpoint
CREATE POLICY "stock_levels_tenant_isolation" ON "stock_levels"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

INSERT INTO "permissions" ("id", "description", "category") VALUES
  ('stock.view', 'View stock levels and movements', 'stock'),
  ('stock.adjust', 'Adjust stock manually', 'stock')
ON CONFLICT ("id") DO UPDATE SET
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category";--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."id" IN ('stock.view', 'stock.adjust')
WHERE r."name" IN ('Owner', 'Manager')
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", 'stock.view'
FROM "roles" r
WHERE r."name" IN ('Cashier', 'Waiter', 'Kitchen')
ON CONFLICT DO NOTHING;--> statement-breakpoint

UPDATE "permission_versions"
SET "version" = greatest("version", 13)
WHERE "business_id" IN (SELECT "id" FROM "businesses");--> statement-breakpoint
