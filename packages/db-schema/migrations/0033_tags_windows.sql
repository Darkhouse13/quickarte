DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dietary_tag_kind') THEN
    CREATE TYPE "dietary_tag_kind" AS ENUM ('dietary', 'allergen');
  END IF;
END
$$;--> statement-breakpoint

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "spice_level" smallint;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_spice_level_check'
  ) THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_spice_level_check"
      CHECK ("spice_level" IS NULL OR ("spice_level" >= 0 AND "spice_level" <= 3));
  END IF;
END
$$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "dietary_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "kind" "dietary_tag_kind" NOT NULL,
  "code" varchar(96) NOT NULL,
  "localized_labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "dietary_tags_code_format_check"
    CHECK ("code" ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$')
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "dietary_tags_business_code_unique"
  ON "dietary_tags" USING btree ("business_id", "code")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dietary_tags_business_position_idx"
  ON "dietary_tags" USING btree ("business_id", "kind", "position")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "product_tags" (
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "product_id" uuid NOT NULL REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action,
  "tag_id" uuid NOT NULL REFERENCES "public"."dietary_tags"("id") ON DELETE cascade ON UPDATE no action,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_tags_product_tag_pk" PRIMARY KEY ("product_id", "tag_id")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "product_tags_business_idx"
  ON "product_tags" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_tags_tag_idx"
  ON "product_tags" USING btree ("tag_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "product_availability_windows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "product_id" uuid NOT NULL REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action,
  "day_of_week" smallint NOT NULL,
  "start_minute" smallint NOT NULL,
  "end_minute" smallint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_availability_windows_day_check"
    CHECK ("day_of_week" >= 0 AND "day_of_week" <= 6),
  CONSTRAINT "product_availability_windows_start_minute_check"
    CHECK ("start_minute" >= 0 AND "start_minute" <= 1439),
  CONSTRAINT "product_availability_windows_end_minute_check"
    CHECK ("end_minute" >= 0 AND "end_minute" <= 1439)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "product_availability_windows_business_idx"
  ON "product_availability_windows" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_availability_windows_product_idx"
  ON "product_availability_windows" USING btree ("product_id", "day_of_week");--> statement-breakpoint

ALTER TABLE "dietary_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dietary_tags" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "dietary_tags_tenant_isolation" ON "dietary_tags";--> statement-breakpoint
CREATE POLICY "dietary_tags_tenant_isolation" ON "dietary_tags"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "product_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_tags" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "product_tags_tenant_isolation" ON "product_tags";--> statement-breakpoint
CREATE POLICY "product_tags_tenant_isolation" ON "product_tags"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "product_availability_windows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_availability_windows" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "product_availability_windows_tenant_isolation" ON "product_availability_windows";--> statement-breakpoint
CREATE POLICY "product_availability_windows_tenant_isolation" ON "product_availability_windows"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint
