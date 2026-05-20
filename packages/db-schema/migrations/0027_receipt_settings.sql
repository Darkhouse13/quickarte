CREATE TABLE "branch_receipt_settings" (
	"branch_id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"logo_url" text,
	"header_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"footer_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"show_item_codes" boolean DEFAULT false NOT NULL,
	"show_tax_breakdown" boolean DEFAULT true NOT NULL,
	"show_server_name" boolean DEFAULT true NOT NULL,
	"show_table_number" boolean DEFAULT true NOT NULL,
	"bilingual_mode" varchar(24) DEFAULT 'fr_only' NOT NULL,
	"paper_width" varchar(8) DEFAULT '80mm' NOT NULL,
	"qr_code_mode" varchar(32) DEFAULT 'none' NOT NULL,
	"qr_code_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_receipt_settings_bilingual_mode_check" CHECK ("branch_receipt_settings"."bilingual_mode" in ('fr_only', 'ar_only', 'stacked', 'side_by_side')),
	CONSTRAINT "branch_receipt_settings_paper_width_check" CHECK ("branch_receipt_settings"."paper_width" in ('58mm', '80mm')),
	CONSTRAINT "branch_receipt_settings_qr_code_mode_check" CHECK ("branch_receipt_settings"."qr_code_mode" in ('none', 'fidelity_signup', 'social_link', 'custom_url')),
	CONSTRAINT "branch_receipt_settings_custom_url_check" CHECK ("branch_receipt_settings"."qr_code_mode" <> 'custom_url' or "branch_receipt_settings"."qr_code_url" is not null)
);
--> statement-breakpoint
ALTER TABLE "branch_receipt_settings" ADD CONSTRAINT "branch_receipt_settings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_receipt_settings" ADD CONSTRAINT "branch_receipt_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branch_receipt_settings_business_idx" ON "branch_receipt_settings" USING btree ("business_id");
--> statement-breakpoint
ALTER TABLE "branch_receipt_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "branch_receipt_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "branch_receipt_settings_tenant_isolation" ON "branch_receipt_settings"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);
