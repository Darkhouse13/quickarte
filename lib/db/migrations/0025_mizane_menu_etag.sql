-- 0025: cache the last GET /menu ETag per integration for conditional (304) fetch
ALTER TABLE "mizane_integrations" ADD COLUMN IF NOT EXISTS "menu_etag" text;
