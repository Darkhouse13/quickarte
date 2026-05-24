DO $$ BEGIN
  CREATE TYPE "public"."unit_dimension" AS ENUM('mass', 'volume', 'count');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."ingredient_category" AS ENUM(
    'meat',
    'dairy',
    'vegetable',
    'spice',
    'dry_good',
    'beverage',
    'alcohol',
    'packaging'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "units_of_measure" (
  "code" varchar(32) PRIMARY KEY NOT NULL,
  "dimension" "public"."unit_dimension" NOT NULL,
  "factor_to_base" numeric(18, 6) NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ingredients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "name" text NOT NULL,
  "localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "category" "public"."ingredient_category" DEFAULT 'dry_good' NOT NULL,
  "stock_uom" varchar(32) NOT NULL REFERENCES "public"."units_of_measure"("code") ON DELETE restrict ON UPDATE no action,
  "current_cost_per_uom" numeric(12, 4),
  "tracked_in_stock" boolean DEFAULT true NOT NULL,
  "supplier_id" uuid,
  "storage_location" text,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "ingredients_current_cost_non_negative"
    CHECK ("current_cost_per_uom" IS NULL OR "current_cost_per_uom" >= 0)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ingredient_unit_conversions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "ingredient_id" uuid NOT NULL REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action,
  "alt_uom" varchar(32) NOT NULL REFERENCES "public"."units_of_measure"("code") ON DELETE restrict ON UPDATE no action,
  "qty_in_stock_uom" numeric(18, 4) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ingredient_unit_conversions_qty_positive"
    CHECK ("qty_in_stock_uom" > 0)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ingredient_tags" (
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "ingredient_id" uuid NOT NULL REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action,
  "tag_id" uuid NOT NULL REFERENCES "public"."dietary_tags"("id") ON DELETE cascade ON UPDATE no action,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ingredient_tags_pk" PRIMARY KEY("ingredient_id", "tag_id")
);--> statement-breakpoint

INSERT INTO "units_of_measure" ("code", "dimension", "factor_to_base") VALUES
  ('g', 'mass', '1'),
  ('kg', 'mass', '1000'),
  ('ml', 'volume', '1'),
  ('l', 'volume', '1000'),
  ('unit', 'count', '1'),
  ('dozen', 'count', '12')
ON CONFLICT ("code") DO UPDATE SET
  "dimension" = EXCLUDED."dimension",
  "factor_to_base" = EXCLUDED."factor_to_base";--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ingredients_business_position_idx"
  ON "ingredients" USING btree ("business_id", "deleted_at", "position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingredients_business_name_idx"
  ON "ingredients" USING btree ("business_id", "name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ingredient_unit_conversions_ingredient_alt_uom_unique"
  ON "ingredient_unit_conversions" USING btree ("ingredient_id", "alt_uom");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingredient_unit_conversions_business_idx"
  ON "ingredient_unit_conversions" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingredient_unit_conversions_ingredient_idx"
  ON "ingredient_unit_conversions" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingredient_tags_business_idx"
  ON "ingredient_tags" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingredient_tags_tag_idx"
  ON "ingredient_tags" USING btree ("tag_id");--> statement-breakpoint

ALTER TABLE "ingredients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingredients" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "ingredients_tenant_isolation" ON "ingredients";--> statement-breakpoint
CREATE POLICY "ingredients_tenant_isolation" ON "ingredients"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "ingredient_unit_conversions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingredient_unit_conversions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "ingredient_unit_conversions_tenant_isolation" ON "ingredient_unit_conversions";--> statement-breakpoint
CREATE POLICY "ingredient_unit_conversions_tenant_isolation" ON "ingredient_unit_conversions"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "ingredient_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingredient_tags" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "ingredient_tags_tenant_isolation" ON "ingredient_tags";--> statement-breakpoint
CREATE POLICY "ingredient_tags_tenant_isolation" ON "ingredient_tags"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

INSERT INTO "permissions" ("id", "description", "category") VALUES
  ('ingredient.view', 'View ingredient catalog', 'ingredients'),
  ('ingredient.manage', 'Manage ingredient catalog', 'ingredients')
ON CONFLICT ("id") DO UPDATE SET
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category";--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."id" IN ('ingredient.view', 'ingredient.manage')
WHERE r."name" IN ('Owner', 'Manager')
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", 'ingredient.view'
FROM "roles" r
WHERE r."name" IN ('Cashier', 'Waiter', 'Kitchen')
ON CONFLICT DO NOTHING;--> statement-breakpoint

UPDATE "permission_versions"
SET "version" = greatest("version", 11)
WHERE "business_id" IN (SELECT "id" FROM "businesses");--> statement-breakpoint
