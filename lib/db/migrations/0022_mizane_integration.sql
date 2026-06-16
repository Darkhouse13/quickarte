-- mizane_integrations: one row per linked business, stores the API key
CREATE TABLE "mizane_integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "business_id" uuid NOT NULL UNIQUE REFERENCES "businesses"("id") ON DELETE CASCADE,
  "api_key" text NOT NULL,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- categories: Mizane sync columns
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "mizane_id" uuid;
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "localized_names" jsonb;
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "categories_mizane_id_unique_idx" ON "categories"("mizane_id") WHERE "mizane_id" IS NOT NULL;
--> statement-breakpoint

-- products: Mizane sync columns
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "mizane_id" uuid;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "localized_names" jsonb;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_mizane_id_unique_idx" ON "products"("mizane_id") WHERE "mizane_id" IS NOT NULL;
--> statement-breakpoint

-- product_variants: Mizane sync columns
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "mizane_id" uuid;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "localized_names" jsonb;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_mizane_id_unique_idx" ON "product_variants"("mizane_id") WHERE "mizane_id" IS NOT NULL;
--> statement-breakpoint

-- product_options: Mizane sync columns
ALTER TABLE "product_options" ADD COLUMN IF NOT EXISTS "mizane_id" uuid;
--> statement-breakpoint
ALTER TABLE "product_options" ADD COLUMN IF NOT EXISTS "localized_names" jsonb;
--> statement-breakpoint
ALTER TABLE "product_options" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_options_mizane_id_unique_idx" ON "product_options"("mizane_id") WHERE "mizane_id" IS NOT NULL;
--> statement-breakpoint

-- option_values: Mizane sync columns
ALTER TABLE "option_values" ADD COLUMN IF NOT EXISTS "mizane_id" uuid;
--> statement-breakpoint
ALTER TABLE "option_values" ADD COLUMN IF NOT EXISTS "localized_names" jsonb;
--> statement-breakpoint
ALTER TABLE "option_values" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "option_values_mizane_id_unique_idx" ON "option_values"("mizane_id") WHERE "mizane_id" IS NOT NULL;
