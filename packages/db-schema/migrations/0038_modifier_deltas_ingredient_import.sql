CREATE TABLE IF NOT EXISTS "modifier_value_ingredient_deltas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "modifier_value_template_id" uuid NOT NULL REFERENCES "public"."modifier_value_templates"("id") ON DELETE cascade ON UPDATE no action,
  "ingredient_id" uuid NOT NULL REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action,
  "quantity_delta" numeric(18, 4) NOT NULL,
  "uom" varchar(32) NOT NULL REFERENCES "public"."units_of_measure"("code") ON DELETE restrict ON UPDATE no action,
  "quantity_is_cooked" boolean DEFAULT false NOT NULL,
  "yield_pct" numeric(7, 4),
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "modifier_value_ingredient_deltas_quantity_nonzero" CHECK ("quantity_delta" <> 0),
  CONSTRAINT "modifier_value_ingredient_deltas_yield_pct_check" CHECK ("yield_pct" IS NULL OR ("yield_pct" > 0 AND "yield_pct" <= 100))
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "modifier_value_ingredient_deltas_business_idx"
  ON "modifier_value_ingredient_deltas" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "modifier_value_ingredient_deltas_value_position_idx"
  ON "modifier_value_ingredient_deltas" USING btree ("modifier_value_template_id", "position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "modifier_value_ingredient_deltas_ingredient_idx"
  ON "modifier_value_ingredient_deltas" USING btree ("ingredient_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ingredient_import_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "status" "public"."menu_import_job_status" DEFAULT 'pending_review' NOT NULL,
  "original_filename" text NOT NULL,
  "file_type" varchar(16) NOT NULL,
  "parsed_rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "preview_report" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "row_count" integer DEFAULT 0 NOT NULL,
  "error_count" integer DEFAULT 0 NOT NULL,
  "warning_count" integer DEFAULT 0 NOT NULL,
  "created_by" uuid REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  "committed_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ingredient_import_jobs_file_type_check" CHECK ("file_type" in ('csv', 'xlsx')),
  CONSTRAINT "ingredient_import_jobs_counts_nonnegative_check" CHECK ("row_count" >= 0 and "error_count" >= 0 and "warning_count" >= 0)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ingredient_import_jobs_business_status_idx"
  ON "ingredient_import_jobs" USING btree ("business_id", "status", "created_at");--> statement-breakpoint

ALTER TABLE "modifier_value_ingredient_deltas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "modifier_value_ingredient_deltas" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "modifier_value_ingredient_deltas_tenant_isolation" ON "modifier_value_ingredient_deltas";--> statement-breakpoint
CREATE POLICY "modifier_value_ingredient_deltas_tenant_isolation" ON "modifier_value_ingredient_deltas"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "ingredient_import_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingredient_import_jobs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "ingredient_import_jobs_tenant_isolation" ON "ingredient_import_jobs";--> statement-breakpoint
CREATE POLICY "ingredient_import_jobs_tenant_isolation" ON "ingredient_import_jobs"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint
