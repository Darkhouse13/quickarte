ALTER TABLE "option_values" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_options" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_options" ADD COLUMN "max_selections" integer;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
