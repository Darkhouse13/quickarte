import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "lib/db/migrations/0019_print_station_routing.sql",
  "utf8",
);

test("0019 adds category print routes without backfilling", () => {
  assert.match(migration, /CREATE TABLE "category_print_routes"/);
  assert.match(migration, /"station" "printer_station" NOT NULL/);
  assert.match(
    migration,
    /PRIMARY KEY\("business_id","category_id","station"\)/,
  );
  assert.match(migration, /ON DELETE cascade/);
  assert.match(
    migration,
    /CREATE INDEX "category_print_routes_business_category_idx"/,
  );
  assert.doesNotMatch(migration, /INSERT INTO "category_print_routes"/);
});
