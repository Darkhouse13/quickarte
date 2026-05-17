import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const config = fs.readFileSync("next.config.ts", "utf8");

test("Next.js config sets core production security headers", () => {
  for (const header of [
    "Strict-Transport-Security",
    "Content-Security-Policy",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
  ]) {
    assert.match(config, new RegExp(header));
  }
  assert.match(config, /frame-ancestors none/);
});
