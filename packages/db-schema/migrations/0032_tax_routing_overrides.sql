CREATE TABLE IF NOT EXISTS "branch_category_tax_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "branch_id" uuid NOT NULL REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action,
  "category_id" uuid NOT NULL REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action,
  "tax_rate_id" varchar(64) NOT NULL REFERENCES "public"."tax_rates"("id") ON DELETE restrict ON UPDATE no action,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "branch_category_tax_overrides_unique"
  ON "branch_category_tax_overrides" USING btree ("branch_id", "category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branch_category_tax_overrides_business_idx"
  ON "branch_category_tax_overrides" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branch_category_tax_overrides_branch_idx"
  ON "branch_category_tax_overrides" USING btree ("branch_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "branch_product_tax_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "branch_id" uuid NOT NULL REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action,
  "product_id" uuid NOT NULL REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action,
  "tax_rate_id" varchar(64) NOT NULL REFERENCES "public"."tax_rates"("id") ON DELETE restrict ON UPDATE no action,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "branch_product_tax_overrides_unique"
  ON "branch_product_tax_overrides" USING btree ("branch_id", "product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branch_product_tax_overrides_business_idx"
  ON "branch_product_tax_overrides" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branch_product_tax_overrides_branch_idx"
  ON "branch_product_tax_overrides" USING btree ("branch_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "branch_category_print_routes" (
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "branch_id" uuid NOT NULL REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action,
  "category_id" uuid NOT NULL REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action,
  "station" varchar(32) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "branch_category_print_routes_branch_category_station_pk"
    PRIMARY KEY ("branch_id", "category_id", "station")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "branch_category_print_routes_business_idx"
  ON "branch_category_print_routes" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branch_category_print_routes_branch_idx"
  ON "branch_category_print_routes" USING btree ("branch_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "branch_product_print_routes" (
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action,
  "branch_id" uuid NOT NULL REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action,
  "product_id" uuid NOT NULL REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action,
  "station" varchar(32) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "branch_product_print_routes_branch_product_station_pk"
    PRIMARY KEY ("branch_id", "product_id", "station")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "branch_product_print_routes_business_idx"
  ON "branch_product_print_routes" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branch_product_print_routes_branch_idx"
  ON "branch_product_print_routes" USING btree ("branch_id");--> statement-breakpoint

ALTER TABLE "branch_category_tax_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "branch_category_tax_overrides" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "branch_category_tax_overrides_tenant_isolation" ON "branch_category_tax_overrides";--> statement-breakpoint
CREATE POLICY "branch_category_tax_overrides_tenant_isolation" ON "branch_category_tax_overrides"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "branch_product_tax_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "branch_product_tax_overrides" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "branch_product_tax_overrides_tenant_isolation" ON "branch_product_tax_overrides";--> statement-breakpoint
CREATE POLICY "branch_product_tax_overrides_tenant_isolation" ON "branch_product_tax_overrides"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "branch_category_print_routes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "branch_category_print_routes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "branch_category_print_routes_tenant_isolation" ON "branch_category_print_routes";--> statement-breakpoint
CREATE POLICY "branch_category_print_routes_tenant_isolation" ON "branch_category_print_routes"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "branch_product_print_routes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "branch_product_print_routes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "branch_product_print_routes_tenant_isolation" ON "branch_product_print_routes";--> statement-breakpoint
CREATE POLICY "branch_product_print_routes_tenant_isolation" ON "branch_product_print_routes"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint
