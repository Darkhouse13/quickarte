import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoroccanPhone } from "./phone";

test("normalizes spaced Moroccan E.164 mobile numbers", () => {
  assert.deepEqual(normalizeMoroccanPhone("+212 6 12 34 56 78"), {
    value: "+212612345678",
    normalized: true,
  });
});

test("normalizes local Moroccan mobile numbers", () => {
  assert.deepEqual(normalizeMoroccanPhone("0612345678"), {
    value: "+212612345678",
    normalized: true,
  });
});

test("keeps unrecognized phone input and flags it", () => {
  assert.deepEqual(normalizeMoroccanPhone("not a phone"), {
    value: "not a phone",
    normalized: false,
  });
});
