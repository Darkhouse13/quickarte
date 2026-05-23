DO $$ BEGIN
  CREATE TYPE "public"."menu_import_job_status" AS ENUM('pending_review', 'committed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "menu_import_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "status" "menu_import_job_status" DEFAULT 'pending_review' NOT NULL,
  "original_filename" text NOT NULL,
  "file_type" varchar(16) NOT NULL,
  "parsed_rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "preview_report" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "row_count" integer DEFAULT 0 NOT NULL,
  "error_count" integer DEFAULT 0 NOT NULL,
  "warning_count" integer DEFAULT 0 NOT NULL,
  "created_by" uuid,
  "committed_at" timestamptz,
  "failed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "menu_import_jobs_file_type_check" CHECK ("file_type" in ('csv', 'xlsx')),
  CONSTRAINT "menu_import_jobs_counts_nonnegative_check" CHECK ("row_count" >= 0 and "error_count" >= 0 and "warning_count" >= 0)
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "menu_import_jobs" ADD CONSTRAINT "menu_import_jobs_business_id_businesses_id_fk"
    FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "menu_import_jobs" ADD CONSTRAINT "menu_import_jobs_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "menu_import_jobs_business_status_idx"
  ON "menu_import_jobs" USING btree ("business_id", "status", "created_at");--> statement-breakpoint

ALTER TABLE "menu_import_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_import_jobs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "menu_import_jobs_tenant_isolation" ON "menu_import_jobs";--> statement-breakpoint
CREATE POLICY "menu_import_jobs_tenant_isolation" ON "menu_import_jobs"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);
