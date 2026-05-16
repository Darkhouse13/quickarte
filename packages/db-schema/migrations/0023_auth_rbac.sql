CREATE TABLE "api_refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "permission_versions" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"category" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" varchar(64) NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "pin_hash" text;--> statement-breakpoint
ALTER TABLE "api_refresh_tokens" ADD CONSTRAINT "api_refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_refresh_tokens_business_user_idx" ON "api_refresh_tokens" USING btree ("business_id","user_id");--> statement-breakpoint
CREATE INDEX "api_refresh_tokens_active_idx" ON "api_refresh_tokens" USING btree ("business_id","expires_at") WHERE "api_refresh_tokens"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_business_name_unique" ON "roles" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "roles_business_id_idx" ON "roles" USING btree ("business_id");--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "roles_tenant_isolation" ON "roles"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "role_permissions_tenant_isolation" ON "role_permissions"
  USING (
    EXISTS (
      SELECT 1 FROM "roles"
      WHERE "roles"."id" = "role_permissions"."role_id"
        AND "roles"."business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "roles"
      WHERE "roles"."id" = "role_permissions"."role_id"
        AND "roles"."business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid
    )
  );--> statement-breakpoint
ALTER TABLE "permission_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "permission_versions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "permission_versions_tenant_isolation" ON "permission_versions"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "api_refresh_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "api_refresh_tokens" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "api_refresh_tokens_tenant_isolation" ON "api_refresh_tokens"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);
