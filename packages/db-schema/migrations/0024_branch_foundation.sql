ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "secondary_currency" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "branches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" varchar(80) NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "address_line1" text,
  "address_line2" text,
  "city" text,
  "postcode" varchar(16),
  "country_code" varchar(2) DEFAULT 'MA' NOT NULL,
  "google_place_id" text,
  "formatted_address" text,
  "lat" numeric(10, 7),
  "lng" numeric(10, 7),
  "phone" text,
  "email" text,
  "website" text,
  "social_links" jsonb,
  "logo" text,
  "cuisine_type" text,
  "seating_capacity" integer,
  "currency" text,
  "timezone" text,
  "locale" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "branches_seating_capacity_non_negative" CHECK ("seating_capacity" IS NULL OR "seating_capacity" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_legal_profiles" (
  "business_id" uuid PRIMARY KEY NOT NULL,
  "legal_name" text NOT NULL,
  "ice_number" varchar(32),
  "rc_number" varchar(32),
  "if_number" varchar(32),
  "patente_number" varchar(32),
  "cnss_number" varchar(32),
  "legal_address" text,
  "legal_city" text,
  "legal_postcode" varchar(16),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "branches" ADD CONSTRAINT "branches_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "business_legal_profiles" ADD CONSTRAINT "business_legal_profiles_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "branches_business_slug_unique" ON "branches" USING btree ("business_id", "slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "branches_one_default_per_business_idx" ON "branches" USING btree ("business_id") WHERE "is_default" = true AND "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branches_business_id_idx" ON "branches" USING btree ("business_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branches_business_active_idx" ON "branches" USING btree ("business_id", "deleted_at") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
INSERT INTO "branches" (
  "business_id",
  "name",
  "slug",
  "is_default",
  "address_line1",
  "city",
  "google_place_id",
  "formatted_address",
  "lat",
  "lng",
  "logo",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "name",
  'main',
  true,
  "address",
  "city",
  "google_place_id",
  "formatted_address",
  "lat",
  "lng",
  "logo",
  now(),
  now()
FROM "businesses" b
WHERE NOT EXISTS (
  SELECT 1
  FROM "branches" existing
  WHERE existing."business_id" = b."id"
    AND existing."is_default" = true
    AND existing."deleted_at" IS NULL
)
ON CONFLICT ("business_id", "slug") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "branches_tenant_isolation" ON "branches"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "business_legal_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "business_legal_profiles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "business_legal_profiles_tenant_isolation" ON "business_legal_profiles"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);
