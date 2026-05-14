CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_access_token" text;--> statement-breakpoint
UPDATE "orders"
SET "customer_access_token" = translate(rtrim(encode(gen_random_bytes(24), 'base64'), '='), '+/', '-_')
WHERE "customer_access_token" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "customer_access_token" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_customer_access_token_idx" ON "orders" USING btree ("customer_access_token");--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "whatsapp_number" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "customer_post_order_message" text;
