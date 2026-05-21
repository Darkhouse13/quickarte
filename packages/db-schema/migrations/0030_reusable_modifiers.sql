DO $$ BEGIN
  CREATE TYPE "public"."modifier_attach_scope" AS ENUM ('product', 'category');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "modifier_group_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "name" text NOT NULL,
  "localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "type" "public"."option_type" DEFAULT 'single_select' NOT NULL,
  "required" boolean DEFAULT false NOT NULL,
  "min_select" integer DEFAULT 0 NOT NULL,
  "max_select" integer,
  "free_quantity" integer DEFAULT 0 NOT NULL,
  "extra_price" numeric(10, 2),
  "attach_scope" "public"."modifier_attach_scope" DEFAULT 'product' NOT NULL,
  "reusable" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "modifier_group_templates_select_bounds_check"
    CHECK ("min_select" >= 0 AND ("max_select" IS NULL OR "max_select" >= "min_select")),
  CONSTRAINT "modifier_group_templates_free_quantity_check"
    CHECK ("free_quantity" >= 0)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "modifier_value_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "group_template_id" uuid NOT NULL REFERENCES "public"."modifier_group_templates"("id") ON DELETE cascade ON UPDATE no action,
  "name" text NOT NULL,
  "localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "price_addition" numeric(10, 2) DEFAULT 0 NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "available" boolean DEFAULT true NOT NULL,
  "recipe_hook_key" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "category_modifier_groups" (
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "category_id" uuid NOT NULL REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action,
  "group_template_id" uuid NOT NULL REFERENCES "public"."modifier_group_templates"("id") ON DELETE cascade ON UPDATE no action,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "category_modifier_groups_category_id_group_template_id_pk"
    PRIMARY KEY ("category_id", "group_template_id")
);--> statement-breakpoint

ALTER TABLE "product_options" ADD COLUMN IF NOT EXISTS "template_id" uuid;--> statement-breakpoint
ALTER TABLE "product_options" ADD COLUMN IF NOT EXISTS "localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "product_options" ADD COLUMN IF NOT EXISTS "free_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_options" ADD COLUMN IF NOT EXISTS "extra_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "option_values" ADD COLUMN IF NOT EXISTS "template_value_id" uuid;--> statement-breakpoint
ALTER TABLE "option_values" ADD COLUMN IF NOT EXISTS "localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "product_options" ADD CONSTRAINT "product_options_template_id_modifier_group_templates_id_fk"
    FOREIGN KEY ("template_id") REFERENCES "public"."modifier_group_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "option_values" ADD CONSTRAINT "option_values_template_value_id_modifier_value_templates_id_fk"
    FOREIGN KEY ("template_value_id") REFERENCES "public"."modifier_value_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "modifier_group_templates_business_idx"
  ON "modifier_group_templates" USING btree ("business_id", "deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "modifier_value_templates_group_position_idx"
  ON "modifier_value_templates" USING btree ("group_template_id", "position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "modifier_value_templates_business_idx"
  ON "modifier_value_templates" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_modifier_groups_business_idx"
  ON "category_modifier_groups" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_modifier_groups_category_position_idx"
  ON "category_modifier_groups" USING btree ("category_id", "position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_options_template_idx"
  ON "product_options" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "option_values_template_value_idx"
  ON "option_values" USING btree ("template_value_id");--> statement-breakpoint

ALTER TABLE "modifier_group_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "modifier_group_templates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "modifier_group_templates_tenant_isolation" ON "modifier_group_templates";--> statement-breakpoint
CREATE POLICY "modifier_group_templates_tenant_isolation" ON "modifier_group_templates"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "modifier_value_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "modifier_value_templates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "modifier_value_templates_tenant_isolation" ON "modifier_value_templates";--> statement-breakpoint
CREATE POLICY "modifier_value_templates_tenant_isolation" ON "modifier_value_templates"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "category_modifier_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "category_modifier_groups" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "category_modifier_groups_tenant_isolation" ON "category_modifier_groups";--> statement-breakpoint
CREATE POLICY "category_modifier_groups_tenant_isolation" ON "category_modifier_groups"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint
