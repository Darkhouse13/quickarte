ALTER TYPE "public"."printer_connection_type" ADD VALUE IF NOT EXISTS 'bluetooth';--> statement-breakpoint
CREATE TABLE "printer_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"printer_id" uuid NOT NULL,
	"role" varchar(32) NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"fallback_printer_id" uuid,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "printer_assignments_role_check" CHECK ("printer_assignments"."role" in ('receipt', 'kitchen', 'bar', 'customer_copy')),
	CONSTRAINT "printer_assignments_fallback_different_check" CHECK ("printer_assignments"."fallback_printer_id" is null or "printer_assignments"."fallback_printer_id" <> "printer_assignments"."printer_id")
);
--> statement-breakpoint
ALTER TABLE "printers" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "printers" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "printers" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "printers" ADD COLUMN "last_test_print_at" timestamp with time zone;--> statement-breakpoint
UPDATE "printers" p
SET "branch_id" = b."id"
FROM "branches" b
WHERE p."branch_id" IS NULL
  AND b."business_id" = p."business_id"
  AND b."is_default" = true
  AND b."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "printer_assignments" ADD CONSTRAINT "printer_assignments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_assignments" ADD CONSTRAINT "printer_assignments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_assignments" ADD CONSTRAINT "printer_assignments_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_assignments" ADD CONSTRAINT "printer_assignments_fallback_printer_id_printers_id_fk" FOREIGN KEY ("fallback_printer_id") REFERENCES "public"."printers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "printer_assignments_branch_role_printer_unique" ON "printer_assignments" USING btree ("branch_id","role","printer_id");--> statement-breakpoint
CREATE INDEX "printer_assignments_business_idx" ON "printer_assignments" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "printer_assignments_branch_idx" ON "printer_assignments" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "printer_assignments_printer_idx" ON "printer_assignments" USING btree ("printer_id");--> statement-breakpoint
ALTER TABLE "printers" ADD CONSTRAINT "printers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "printers_branch_id_idx" ON "printers" USING btree ("branch_id");--> statement-breakpoint
ALTER TABLE "printer_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "printer_assignments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "printer_assignments_tenant_isolation" ON "printer_assignments"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);
