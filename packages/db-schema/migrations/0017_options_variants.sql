DO $$ BEGIN
  CREATE TYPE "public"."option_type" AS ENUM('single_select', 'multi_select');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_options" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action,
  "name" text NOT NULL,
  "type" "public"."option_type" DEFAULT 'single_select' NOT NULL,
  "required" boolean DEFAULT false NOT NULL,
  "min_select" integer DEFAULT 0 NOT NULL,
  "max_select" integer,
  "position" integer DEFAULT 0 NOT NULL,
  "available" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "option_values" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "option_id" uuid NOT NULL REFERENCES "public"."product_options"("id") ON DELETE cascade ON UPDATE no action,
  "name" text NOT NULL,
  "price_addition" numeric(10, 2) DEFAULT '0' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "available" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action,
  "name" text NOT NULL,
  "price_override" numeric(10, 2),
  "position" integer DEFAULT 0 NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "available" boolean DEFAULT true NOT NULL,
  "option_max_selections_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_options" ADD COLUMN IF NOT EXISTS "min_select" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_options" ADD COLUMN IF NOT EXISTS "max_select" integer;
--> statement-breakpoint
ALTER TABLE "product_options" ADD COLUMN IF NOT EXISTS "available" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "option_values" ADD COLUMN IF NOT EXISTS "available" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "available" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "option_max_selections_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_options'
      AND column_name = 'max_selections'
  ) THEN
    EXECUTE 'UPDATE "product_options" SET "max_select" = "max_selections" WHERE "max_select" IS NULL';
  END IF;
END $$;
--> statement-breakpoint
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY product_id
      ORDER BY is_default DESC, position ASC, created_at ASC, id ASC
    ) AS rn
  FROM product_variants
)
UPDATE product_variants pv
SET is_default = (ranked.rn = 1)
FROM ranked
WHERE pv.id = ranked.id;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_options_product_id_position_idx"
  ON "product_options" ("product_id", "position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "option_values_option_id_position_idx"
  ON "option_values" ("option_id", "position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_variants_product_id_position_idx"
  ON "product_variants" ("product_id", "position");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_one_default_idx"
  ON "product_variants" ("product_id")
  WHERE "is_default" = true;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_options_min_select_nonnegative'
  ) THEN
    ALTER TABLE "product_options"
      ADD CONSTRAINT "product_options_min_select_nonnegative"
      CHECK ("min_select" >= 0);
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_options_max_select_nonnegative'
  ) THEN
    ALTER TABLE "product_options"
      ADD CONSTRAINT "product_options_max_select_nonnegative"
      CHECK ("max_select" IS NULL OR "max_select" >= 0);
  END IF;
END $$;
