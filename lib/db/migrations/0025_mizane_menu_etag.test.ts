import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(__dirname, "0025_mizane_menu_etag.sql"),
  "utf8",
);

describe("0025_mizane_menu_etag migration", () => {
  it("adds menu_etag to mizane_integrations (idempotent)", () => {
    assert.ok(
      sql.includes(
        'ALTER TABLE "mizane_integrations" ADD COLUMN IF NOT EXISTS "menu_etag"',
      ),
      "missing menu_etag column on mizane_integrations",
    );
  });

  it("stores menu_etag as text", () => {
    assert.ok(/"menu_etag"\s+text/.test(sql), "menu_etag should be text");
  });

  it("uses IF NOT EXISTS so the migration can re-run safely", () => {
    assert.ok(sql.includes("ADD COLUMN IF NOT EXISTS"), "column add not guarded");
  });
});
