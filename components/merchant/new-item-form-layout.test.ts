import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("components/merchant/new-item-form.tsx", "utf8");

test("new item form reserves enough scroll space above fixed save bar and merchant nav", () => {
  assert.match(source, /pb-48/);
  assert.match(source, /<BottomBar\s+maxWidth=\{390\}>/);
});
