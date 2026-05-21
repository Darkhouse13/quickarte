DO $$ BEGIN
  CREATE TYPE "public"."product_variant_kind" AS ENUM ('size', 'protein', 'topping', 'market', 'custom');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."product_variant_pricing_mode" AS ENUM ('fixed', 'variable_pos');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "menu_locale_settings" (
  "business_id" uuid PRIMARY KEY REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "active_locales" jsonb DEFAULT '["fr"]'::jsonb NOT NULL,
  "default_locale" varchar(16) DEFAULT 'fr' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "product_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "product_id" uuid NOT NULL REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action,
  "url" text NOT NULL,
  "alt_text" text,
  "position" integer DEFAULT 0 NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "localized_descriptions" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "color_tag" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sku" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "item_code" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "color_tag" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "available_dine_in" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "available_takeaway" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "available_delivery" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "available_qr" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "available_online" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "localized_descriptions" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint

ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "variant_kind" "public"."product_variant_kind" DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "pricing_mode" "public"."product_variant_pricing_mode" DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "display_price_label" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "display_price_min" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "display_price_max" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "unit_label" text;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk"
    FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_not_self_check"
    CHECK ("parent_id" IS NULL OR "parent_id" <> "id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "categories_business_parent_position_idx"
  ON "categories" USING btree ("business_id", "parent_id", "position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "categories_business_slug_unique"
  ON "categories" USING btree ("business_id", "slug")
  WHERE "slug" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_business_category_position_idx"
  ON "products" USING btree ("business_id", "category_id", "position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_business_sku_idx"
  ON "products" USING btree ("business_id", "sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_business_item_code_idx"
  ON "products" USING btree ("business_id", "item_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_images_product_position_unique"
  ON "product_images" USING btree ("product_id", "position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_images_one_primary_idx"
  ON "product_images" USING btree ("product_id")
  WHERE "is_primary" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_images_business_idx"
  ON "product_images" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_images_product_idx"
  ON "product_images" USING btree ("product_id");--> statement-breakpoint

ALTER TABLE "menu_locale_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_locale_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "menu_locale_settings_tenant_isolation" ON "menu_locale_settings";--> statement-breakpoint
CREATE POLICY "menu_locale_settings_tenant_isolation" ON "menu_locale_settings"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_images" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "product_images_tenant_isolation" ON "product_images";--> statement-breakpoint
CREATE POLICY "product_images_tenant_isolation" ON "product_images"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

INSERT INTO "permissions" ("id", "description", "category") VALUES
  ('menu.view', 'View menu catalog', 'menu'),
  ('menu.manage', 'Manage menu catalog', 'menu')
ON CONFLICT ("id") DO UPDATE SET
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category";--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."id" IN ('menu.view', 'menu.manage')
WHERE r."name" IN ('Owner', 'Manager')
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", 'menu.view'
FROM "roles" r
WHERE r."name" IN ('Cashier', 'Waiter', 'Kitchen')
ON CONFLICT DO NOTHING;--> statement-breakpoint

UPDATE "permission_versions"
SET "version" = greatest("version", 6)
WHERE "business_id" IN (SELECT "id" FROM "businesses");--> statement-breakpoint
