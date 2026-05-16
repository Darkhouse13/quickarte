-- Drop boulangerie and brunch from business type enum.
-- Data migration: boulangerie -> autre, brunch -> cafe.
-- Legacy values outside the Morocco wedge also collapse to autre.
-- Postgres does not allow dropping enum values in place, so we recreate the enum.

CREATE TYPE "public"."business_type_new" AS ENUM ('restaurant', 'cafe', 'autre');--> statement-breakpoint

ALTER TABLE "businesses"
  ALTER COLUMN "type" DROP DEFAULT;--> statement-breakpoint

ALTER TABLE "businesses"
  ALTER COLUMN "type" TYPE "public"."business_type_new"
  USING (
    CASE "type"::text
      WHEN 'boulangerie' THEN 'autre'
      WHEN 'brunch' THEN 'cafe'
      WHEN 'hotel' THEN 'autre'
      WHEN 'retail' THEN 'autre'
      WHEN 'other' THEN 'autre'
      ELSE "type"::text
    END
  )::"public"."business_type_new";--> statement-breakpoint

DROP TYPE "public"."business_type";--> statement-breakpoint
ALTER TYPE "public"."business_type_new" RENAME TO "business_type";--> statement-breakpoint

ALTER TABLE "businesses"
  ALTER COLUMN "type" SET DEFAULT 'cafe';
