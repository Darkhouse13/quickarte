ALTER TABLE "printers" ADD COLUMN "webprint_token" text;--> statement-breakpoint
ALTER TABLE "printers" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "printers" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "print_jobs" ALTER COLUMN "order_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "printers_webprint_token_idx" ON "printers" USING btree ("webprint_token");--> statement-breakpoint
CREATE INDEX "print_jobs_printer_status_created_at_idx" ON "print_jobs" USING btree ("printer_id","status","created_at");
