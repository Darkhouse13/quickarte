CREATE TABLE "branch_closed_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"date" date NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch_operating_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"schedule_type" varchar(24) DEFAULT 'normal' NOT NULL,
	"day_of_week" smallint NOT NULL,
	"opens_at" time,
	"closes_at" time,
	"is_closed" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_operating_hours_schedule_type_check" CHECK ("schedule_type" in ('normal', 'ramadan')),
	CONSTRAINT "branch_operating_hours_day_check" CHECK ("day_of_week" between 0 and 6),
	CONSTRAINT "branch_operating_hours_time_closed_check" CHECK (("is_closed" = true and "opens_at" is null and "closes_at" is null) or ("is_closed" = false and "opens_at" is not null and "closes_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "branch_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"method_code" varchar(64),
	"custom_name" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"cash_drawer_auto_open" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_payment_methods_builtin_or_custom_check" CHECK (("method_code" is not null and "custom_name" is null) or ("method_code" is null and "custom_name" is not null))
);
--> statement-breakpoint
CREATE TABLE "branch_schedule_settings" (
	"branch_id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"ramadan_mode_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_method_definitions" (
	"code" varchar(64) PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"category" varchar(32) NOT NULL,
	"is_builtin" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DROP INDEX "branches_business_slug_unique";--> statement-breakpoint
ALTER TABLE "branch_closed_days" ADD CONSTRAINT "branch_closed_days_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_closed_days" ADD CONSTRAINT "branch_closed_days_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_operating_hours" ADD CONSTRAINT "branch_operating_hours_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_operating_hours" ADD CONSTRAINT "branch_operating_hours_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_payment_methods" ADD CONSTRAINT "branch_payment_methods_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_payment_methods" ADD CONSTRAINT "branch_payment_methods_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_payment_methods" ADD CONSTRAINT "branch_payment_methods_method_code_payment_method_definitions_code_fk" FOREIGN KEY ("method_code") REFERENCES "public"."payment_method_definitions"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_schedule_settings" ADD CONSTRAINT "branch_schedule_settings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_schedule_settings" ADD CONSTRAINT "branch_schedule_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branch_closed_days_branch_date_unique" ON "branch_closed_days" USING btree ("branch_id","date");--> statement-breakpoint
CREATE INDEX "branch_closed_days_business_idx" ON "branch_closed_days" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "branch_closed_days_branch_idx" ON "branch_closed_days" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "branch_operating_hours_unique" ON "branch_operating_hours" USING btree ("branch_id","schedule_type","day_of_week","position");--> statement-breakpoint
CREATE INDEX "branch_operating_hours_business_idx" ON "branch_operating_hours" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "branch_operating_hours_branch_idx" ON "branch_operating_hours" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "branch_payment_methods_builtin_unique" ON "branch_payment_methods" USING btree ("branch_id","method_code") WHERE "method_code" is not null;--> statement-breakpoint
CREATE INDEX "branch_payment_methods_business_idx" ON "branch_payment_methods" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "branch_payment_methods_branch_idx" ON "branch_payment_methods" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_business_slug_unique" ON "branches" USING btree ("business_id","slug") WHERE "deleted_at" is null;
--> statement-breakpoint
INSERT INTO "payment_method_definitions" ("code", "label", "category", "is_builtin", "sort_order") VALUES
  ('cash', 'Cash', 'cash', true, 10),
  ('cmi_card', 'CMI card', 'card', true, 20),
  ('inwi_money', 'Inwi Money', 'wallet', true, 30),
  ('orange_money', 'Orange Money', 'wallet', true, 40),
  ('marocpay', 'MarocPay', 'wallet', true, 50),
  ('voucher', 'Voucher', 'voucher', true, 60),
  ('comp', 'Comp', 'comp', true, 70),
  ('other', 'Other', 'custom', true, 80)
ON CONFLICT ("code") DO UPDATE SET
  "label" = excluded."label",
  "category" = excluded."category",
  "is_builtin" = excluded."is_builtin",
  "sort_order" = excluded."sort_order";
--> statement-breakpoint
ALTER TABLE "branch_operating_hours" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "branch_operating_hours" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "branch_operating_hours_tenant_isolation" ON "branch_operating_hours"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "branch_schedule_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "branch_schedule_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "branch_schedule_settings_tenant_isolation" ON "branch_schedule_settings"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "branch_closed_days" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "branch_closed_days" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "branch_closed_days_tenant_isolation" ON "branch_closed_days"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "branch_payment_methods" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "branch_payment_methods" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "branch_payment_methods_tenant_isolation" ON "branch_payment_methods"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);
