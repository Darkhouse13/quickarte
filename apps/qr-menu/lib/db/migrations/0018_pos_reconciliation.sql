DO $$ BEGIN
  CREATE TYPE "public"."pos_status" AS ENUM('not_required', 'pending', 'entered', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pos_status" "public"."pos_status" DEFAULT 'not_required' NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pos_entered_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pos_entered_by_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pos_reference" text;
--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "pos_coexistence_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "orders"
SET
  "pos_status" = 'not_required',
  "pos_entered_at" = NULL,
  "pos_entered_by_user_id" = NULL,
  "pos_reference" = NULL
WHERE "pos_status" IS NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_pos_entered_by_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_pos_entered_by_user_id_users_id_fk"
      FOREIGN KEY ("pos_entered_by_user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_pos_reference_max_64'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_pos_reference_max_64"
      CHECK ("pos_reference" IS NULL OR char_length("pos_reference") <= 64);
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_business_pos_status_created_at_idx"
  ON "orders" ("business_id", "pos_status", "created_at");
