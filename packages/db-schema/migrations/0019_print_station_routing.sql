CREATE TABLE "category_print_routes" (
  "business_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  "station" "printer_station" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "category_print_routes_business_id_category_id_station_pk" PRIMARY KEY("business_id","category_id","station")
);--> statement-breakpoint
ALTER TABLE "category_print_routes" ADD CONSTRAINT "category_print_routes_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_print_routes" ADD CONSTRAINT "category_print_routes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_print_routes_business_category_idx" ON "category_print_routes" USING btree ("business_id","category_id");
