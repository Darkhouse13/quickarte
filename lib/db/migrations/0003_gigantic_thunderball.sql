CREATE TYPE "public"."accrual_type" AS ENUM('per_visit', 'per_euro');--> statement-breakpoint
CREATE TYPE "public"."loyalty_source" AS ENUM('online_order', 'manual_in_person', 'admin_adjust');--> statement-breakpoint
CREATE TYPE "public"."loyalty_transaction_type" AS ENUM('earn', 'redeem', 'adjust');--> statement-breakpoint
CREATE TABLE "loyalty_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"lifetime_earned" numeric(10, 2) DEFAULT '0' NOT NULL,
	"lifetime_redeemed" integer DEFAULT 0 NOT NULL,
	"last_visit_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_customers_business_phone_unique" UNIQUE("business_id","phone")
);
--> statement-breakpoint
CREATE TABLE "loyalty_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text,
	"accrual_type" "accrual_type" DEFAULT 'per_visit' NOT NULL,
	"accrual_rate" numeric(10, 2) DEFAULT '1' NOT NULL,
	"reward_threshold" numeric(10, 2) NOT NULL,
	"reward_description" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_programs_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "loyalty_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_id" uuid,
	"type" "loyalty_transaction_type" NOT NULL,
	"delta" numeric(10, 2) NOT NULL,
	"source" "loyalty_source" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loyalty_customers" ADD CONSTRAINT "loyalty_customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_customer_id_loyalty_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."loyalty_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loyalty_customers_business_balance_idx" ON "loyalty_customers" USING btree ("business_id","balance");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_customer_id_idx" ON "loyalty_transactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_order_id_idx" ON "loyalty_transactions" USING btree ("order_id");