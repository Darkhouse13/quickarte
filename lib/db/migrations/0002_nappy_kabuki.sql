CREATE TYPE "public"."entitlement_source" AS ENUM('trial', 'paid', 'manual', 'grandfathered');--> statement-breakpoint
CREATE TYPE "public"."module_key" AS ENUM('menu_qr', 'online_ordering', 'loyalty', 'analytics');--> statement-breakpoint
ALTER TYPE "public"."business_type" ADD VALUE 'boulangerie' BEFORE 'restaurant';--> statement-breakpoint
CREATE TABLE "business_entitlements" (
	"business_id" uuid NOT NULL,
	"module" "module_key" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"plan_tier" text,
	"valid_until" timestamp with time zone,
	"source" "entitlement_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_entitlements_business_id_module_pk" PRIMARY KEY("business_id","module")
);
--> statement-breakpoint
ALTER TABLE "businesses" ALTER COLUMN "currency" SET DEFAULT 'EUR';--> statement-breakpoint
ALTER TABLE "businesses" ALTER COLUMN "timezone" SET DEFAULT 'Europe/Paris';--> statement-breakpoint
ALTER TABLE "business_entitlements" ADD CONSTRAINT "business_entitlements_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_entitlements_business_id_idx" ON "business_entitlements" USING btree ("business_id");