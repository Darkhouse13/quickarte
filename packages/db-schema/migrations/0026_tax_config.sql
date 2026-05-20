CREATE TABLE "branch_tax_settings" (
	"branch_id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"default_tax_rate_id" varchar(64) NOT NULL,
	"tax_application_level" varchar(24) DEFAULT 'category' NOT NULL,
	"price_display_mode" varchar(24) DEFAULT 'ttc' NOT NULL,
	"service_charge_enabled" boolean DEFAULT false NOT NULL,
	"service_charge_rate" numeric(5, 2),
	"service_charge_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_tax_settings_application_level_check" CHECK ("branch_tax_settings"."tax_application_level" in ('item', 'category')),
	CONSTRAINT "branch_tax_settings_price_display_mode_check" CHECK ("branch_tax_settings"."price_display_mode" in ('ttc', 'ht_plus_tva')),
	CONSTRAINT "branch_tax_settings_service_charge_rate_range_check" CHECK ("branch_tax_settings"."service_charge_rate" is null or ("branch_tax_settings"."service_charge_rate" >= 0 and "branch_tax_settings"."service_charge_rate" <= 100)),
	CONSTRAINT "branch_tax_settings_service_charge_enabled_rate_check" CHECK ("branch_tax_settings"."service_charge_enabled" = false or "branch_tax_settings"."service_charge_rate" is not null)
);
--> statement-breakpoint
CREATE TABLE "tax_rates" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"country_code" varchar(2) DEFAULT 'MA' NOT NULL,
	"label" text NOT NULL,
	"rate" numeric(5, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO "tax_rates" ("id", "country_code", "label", "rate", "is_active")
VALUES
  ('ma_tva_20', 'MA', 'TVA 20%', 20.00, true),
  ('ma_tva_14', 'MA', 'TVA 14%', 14.00, true),
  ('ma_tva_10', 'MA', 'TVA 10% (restauration)', 10.00, true),
  ('ma_tva_7', 'MA', 'TVA 7%', 7.00, true),
  ('ma_tva_0', 'MA', 'TVA 0%', 0.00, true)
ON CONFLICT ("id") DO UPDATE SET
  "country_code" = EXCLUDED."country_code",
  "label" = EXCLUDED."label",
  "rate" = EXCLUDED."rate",
  "is_active" = EXCLUDED."is_active";
--> statement-breakpoint
ALTER TABLE "branch_tax_settings" ADD CONSTRAINT "branch_tax_settings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_tax_settings" ADD CONSTRAINT "branch_tax_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_tax_settings" ADD CONSTRAINT "branch_tax_settings_default_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("default_tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branch_tax_settings_business_idx" ON "branch_tax_settings" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "branch_tax_settings_tax_rate_idx" ON "branch_tax_settings" USING btree ("default_tax_rate_id");
--> statement-breakpoint
ALTER TABLE "branch_tax_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "branch_tax_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "branch_tax_settings_tenant_isolation" ON "branch_tax_settings"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);
