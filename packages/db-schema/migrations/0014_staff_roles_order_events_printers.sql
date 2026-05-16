CREATE TYPE "public"."staff_role" AS ENUM('owner', 'manager', 'waiter', 'kitchen', 'cashier');--> statement-breakpoint
CREATE TYPE "public"."printer_station" AS ENUM('counter', 'kitchen', 'bar');--> statement-breakpoint
CREATE TYPE "public"."printer_connection_type" AS ENUM('manual', 'escpos_lan', 'escpos_usb', 'webprint');--> statement-breakpoint
CREATE TYPE "public"."print_job_status" AS ENUM('pending', 'printed', 'failed', 'manual');--> statement-breakpoint
CREATE TABLE "staff_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "user_id" uuid,
  "email" text,
  "display_name" text NOT NULL,
  "role" "staff_role" NOT NULL,
  "invited_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "staff_invite_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "staff_member_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "staff_invite_tokens_token_hash_unique" UNIQUE("token_hash")
);--> statement-breakpoint
CREATE TABLE "order_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "actor_user_id" uuid,
  "actor_role" text,
  "payload_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "printers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "name" text NOT NULL,
  "station" "printer_station" NOT NULL,
  "connection_type" "printer_connection_type" NOT NULL,
  "address" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "print_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "printer_id" uuid NOT NULL,
  "status" "print_job_status" DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "payload_text" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "printed_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite_tokens" ADD CONSTRAINT "staff_invite_tokens_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printers" ADD CONSTRAINT "printers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_members_business_id_idx" ON "staff_members" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_members_user_business_active_idx" ON "staff_members" USING btree ("user_id","business_id") WHERE "staff_members"."user_id" is not null and "staff_members"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_members_email_business_active_idx" ON "staff_members" USING btree ("email","business_id") WHERE "staff_members"."email" is not null and "staff_members"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "staff_invite_tokens_staff_member_id_idx" ON "staff_invite_tokens" USING btree ("staff_member_id");--> statement-breakpoint
CREATE INDEX "order_events_order_id_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_events_event_type_idx" ON "order_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "printers_business_id_idx" ON "printers" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "print_jobs_order_id_idx" ON "print_jobs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "print_jobs_printer_id_idx" ON "print_jobs" USING btree ("printer_id");--> statement-breakpoint
INSERT INTO "staff_members" (
  "business_id",
  "user_id",
  "email",
  "display_name",
  "role",
  "accepted_at",
  "created_at",
  "updated_at"
)
SELECT
  b."id",
  b."owner_id",
  u."email",
  COALESCE(NULLIF(u."name", ''), u."email", b."name"),
  'owner',
  now(),
  now(),
  now()
FROM "businesses" b
JOIN "users" u ON u."id" = b."owner_id"
ON CONFLICT DO NOTHING;
