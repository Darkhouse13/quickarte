DO $$ BEGIN
  CREATE TYPE "public"."loyalty_type" AS ENUM('points', 'stamp', 'credits');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."payment_mode" AS ENUM('mad', 'credits');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."credit_transaction_source" AS ENUM(
    'order_spend',
    'google_review',
    'manual_grant',
    'redemption',
    'manual_adjustment'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "loyalty_programs" ADD COLUMN IF NOT EXISTS "loyalty_type" "public"."loyalty_type" DEFAULT 'points' NOT NULL;
--> statement-breakpoint
ALTER TABLE "loyalty_programs" ADD COLUMN IF NOT EXISTS "credit_label" text DEFAULT 'Crédits' NOT NULL;
--> statement-breakpoint
ALTER TABLE "loyalty_programs" ADD COLUMN IF NOT EXISTS "accrual_per_mad" numeric(10, 4) DEFAULT '1.0000' NOT NULL;
--> statement-breakpoint
ALTER TABLE "loyalty_programs" ADD COLUMN IF NOT EXISTS "min_order_for_accrual_mad" numeric(10, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "loyalty_programs" ADD COLUMN IF NOT EXISTS "review_reward_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "loyalty_programs" ADD COLUMN IF NOT EXISTS "credits_per_review" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "loyalty_programs" ADD COLUMN IF NOT EXISTS "review_max_age_days" integer DEFAULT 30 NOT NULL;
--> statement-breakpoint
ALTER TABLE "loyalty_programs" ADD COLUMN IF NOT EXISTS "redemption_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "loyalty_programs" ADD COLUMN IF NOT EXISTS "min_balance_to_redeem" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "google_place_id" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_mode" "public"."payment_mode" DEFAULT 'mad' NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "credits_used" integer;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "credit_unit_price" integer;
--> statement-breakpoint
UPDATE "orders" SET "payment_mode" = 'mad', "credits_used" = NULL WHERE "payment_mode" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "customer_phone_normalized" text NOT NULL,
  "balance" integer DEFAULT 0 NOT NULL,
  "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "loyalty_members_business_phone_unique" UNIQUE("business_id", "customer_phone_normalized")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_members_business_balance_idx"
  ON "loyalty_members" ("business_id", "balance");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "redemption_listings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "product_id" uuid NOT NULL REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action,
  "credit_price" integer NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "redemption_listings_business_product_unique" UNIQUE("business_id", "product_id"),
  CONSTRAINT "redemption_listings_credit_price_positive" CHECK ("credit_price" > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "redemption_listings_business_active_position_idx"
  ON "redemption_listings" ("business_id", "active", "position");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "customer_phone_normalized" text NOT NULL,
  "amount" integer NOT NULL,
  "source" "public"."credit_transaction_source" NOT NULL,
  "source_ref" text,
  "description" text,
  "actor_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_system_source_unique"
  ON "credit_transactions" ("business_id", "source", "source_ref")
  WHERE "source" IN ('order_spend', 'google_review', 'redemption');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_customer_created_idx"
  ON "credit_transactions" ("business_id", "customer_phone_normalized", "created_at" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_review_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "customer_phone_normalized" text NOT NULL,
  "google_review_name" text NOT NULL,
  "google_author_display_name" text NOT NULL,
  "google_review_publish_time" timestamp with time zone NOT NULL,
  "google_review_rating" integer,
  "credit_transaction_id" uuid NOT NULL REFERENCES "public"."credit_transactions"("id") ON DELETE no action ON UPDATE no action,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "google_review_grants_business_review_unique" UNIQUE("business_id", "google_review_name")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "google_review_grants_customer_created_idx"
  ON "google_review_grants" ("business_id", "customer_phone_normalized", "created_at" DESC);
