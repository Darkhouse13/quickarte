import assert from "node:assert/strict";
import test from "node:test";
import { moroccanPhoneSchema, normalizeMoroccanPhone } from "./phone";

test("normalizes Moroccan mobile numbers to E.164", () => {
  assert.equal(normalizeMoroccanPhone("+212 6 12 34 56 78"), "+212612345678");
  assert.equal(normalizeMoroccanPhone("06 12 34 56 78"), "+212612345678");
});

test("phone schema accepts Moroccan mobile formats", () => {
  assert.equal(
    moroccanPhoneSchema.parse("+212 6 12 34 56 78"),
    "+212612345678",
  );
  assert.equal(moroccanPhoneSchema.parse("06 12 34 56 78"), "+212612345678");
});
