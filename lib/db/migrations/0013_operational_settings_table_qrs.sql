ALTER TABLE "business_settings" ADD COLUMN "menu_qr_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "loyalty_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "analytics_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "table_qr_count" integer DEFAULT 0 NOT NULL;
