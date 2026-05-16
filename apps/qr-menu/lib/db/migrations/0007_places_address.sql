ALTER TABLE "businesses" ADD COLUMN "google_place_id" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "formatted_address" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "lat" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "lng" numeric(10, 7);