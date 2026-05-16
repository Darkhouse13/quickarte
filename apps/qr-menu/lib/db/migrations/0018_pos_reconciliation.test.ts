import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "lib/db/migrations/0018_pos_reconciliation.sql",
  "utf8",
);

test("0018 adds POS status fields with safe existing-order defaults", () => {
  assert.match(migration, /CREATE TYPE "public"."pos_status"/);
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS "pos_status" "public"."pos_status" DEFAULT 'not_required' NOT NULL/,
  );
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "pos_entered_at"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "pos_entered_by_user_id"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "pos_reference"/);
  assert.match(migration, /"pos_status" = 'not_required'/);
  assert.match(migration, /"pos_entered_at" = NULL/);
  assert.match(migration, /"pos_entered_by_user_id" = NULL/);
});

test("0018 adds business toggle, reference limit, foreign key, and cloture index", () => {
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS "pos_coexistence_enabled" boolean DEFAULT false NOT NULL/,
  );
  assert.match(migration, /orders_pos_entered_by_user_id_users_id_fk/);
  assert.match(migration, /orders_pos_reference_max_64/);
  assert.match(migration, /char_length\("pos_reference"\) <= 64/);
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS "orders_business_pos_status_created_at_idx"/,
  );
});
