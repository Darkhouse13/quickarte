ALTER TABLE "option_values"
  ADD COLUMN IF NOT EXISTS "allow_quantity" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "option_values"
  ADD COLUMN IF NOT EXISTS "max_quantity" integer;
