CREATE TABLE "contact_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" text NOT NULL,
	"commerce" text NOT NULL,
	"ville" text NOT NULL,
	"telephone" text NOT NULL,
	"message" text,
	"ip" text,
	"user_agent" text,
	"email_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "contact_requests_ip_created_idx" ON "contact_requests" USING btree ("ip","created_at");--> statement-breakpoint
CREATE INDEX "contact_requests_created_idx" ON "contact_requests" USING btree ("created_at");