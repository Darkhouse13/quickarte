DO $$ BEGIN
  CREATE TYPE "public"."recipe_component_type" AS ENUM('ingredient', 'sub_recipe');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "recipes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "variant_id" uuid REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action,
  "name" text NOT NULL,
  "localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "yield_qty" numeric(18, 4) DEFAULT 1 NOT NULL,
  "yield_uom" varchar(32) REFERENCES "public"."units_of_measure"("code") ON DELETE restrict ON UPDATE no action,
  "prep_notes" text,
  "photo_url" text,
  "computed_cost" numeric(14, 4) DEFAULT 0 NOT NULL,
  "cost_is_complete" boolean DEFAULT true NOT NULL,
  "food_cost_pct" numeric(9, 4),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "recipes_yield_qty_positive" CHECK ("yield_qty" > 0),
  CONSTRAINT "recipes_sub_recipe_yield_uom_required" CHECK ("variant_id" IS NOT NULL OR "yield_uom" IS NOT NULL),
  CONSTRAINT "recipes_computed_cost_non_negative" CHECK ("computed_cost" >= 0),
  CONSTRAINT "recipes_food_cost_pct_non_negative" CHECK ("food_cost_pct" IS NULL OR "food_cost_pct" >= 0)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "recipe_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "recipe_id" uuid NOT NULL REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action,
  "component_type" "public"."recipe_component_type" NOT NULL,
  "ingredient_id" uuid REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action,
  "sub_recipe_id" uuid REFERENCES "public"."recipes"("id") ON DELETE restrict ON UPDATE no action,
  "quantity" numeric(18, 4) NOT NULL,
  "uom" varchar(32) NOT NULL REFERENCES "public"."units_of_measure"("code") ON DELETE restrict ON UPDATE no action,
  "yield_pct" numeric(7, 4),
  "quantity_is_cooked" boolean DEFAULT false NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "recipe_lines_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "recipe_lines_yield_pct_bounds" CHECK ("yield_pct" IS NULL OR ("yield_pct" > 0 AND "yield_pct" <= 100)),
  CONSTRAINT "recipe_lines_component_xor" CHECK (
    (
      "component_type" = 'ingredient'
      AND "ingredient_id" IS NOT NULL
      AND "sub_recipe_id" IS NULL
    ) OR (
      "component_type" = 'sub_recipe'
      AND "sub_recipe_id" IS NOT NULL
      AND "ingredient_id" IS NULL
    )
  )
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "recipes_business_idx"
  ON "recipes" USING btree ("business_id", "deleted_at", "name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recipes_one_active_per_variant_idx"
  ON "recipes" USING btree ("variant_id")
  WHERE "variant_id" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_lines_recipe_position_idx"
  ON "recipe_lines" USING btree ("recipe_id", "position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_lines_business_idx"
  ON "recipe_lines" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_lines_ingredient_idx"
  ON "recipe_lines" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_lines_sub_recipe_idx"
  ON "recipe_lines" USING btree ("sub_recipe_id");--> statement-breakpoint

ALTER TABLE "recipes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recipes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "recipes_tenant_isolation" ON "recipes";--> statement-breakpoint
CREATE POLICY "recipes_tenant_isolation" ON "recipes"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "recipe_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recipe_lines" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "recipe_lines_tenant_isolation" ON "recipe_lines";--> statement-breakpoint
CREATE POLICY "recipe_lines_tenant_isolation" ON "recipe_lines"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

INSERT INTO "permissions" ("id", "description", "category") VALUES
  ('recipe.view', 'View recipes and recipe costs', 'recipes'),
  ('recipe.manage', 'Manage recipes and recipe costs', 'recipes')
ON CONFLICT ("id") DO UPDATE SET
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category";--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."id" IN ('recipe.view', 'recipe.manage')
WHERE r."name" IN ('Owner', 'Manager')
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", 'recipe.view'
FROM "roles" r
WHERE r."name" IN ('Cashier', 'Waiter', 'Kitchen')
ON CONFLICT DO NOTHING;--> statement-breakpoint

UPDATE "permission_versions"
SET "version" = greatest("version", 12)
WHERE "business_id" IN (SELECT "id" FROM "businesses");--> statement-breakpoint
