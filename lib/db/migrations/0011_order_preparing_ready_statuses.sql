ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'preparing' AFTER 'confirmed';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'ready' AFTER 'preparing';
