import assert from "node:assert/strict";
import test from "node:test";
import { parseTableContext, parseTableNumber } from "./table";

const UUID = "b0000000-0000-4000-8000-000000000096";

test("parseTableNumber accepts positive integer query values", () => {
  assert.equal(parseTableNumber("7"), 7);
  assert.equal(parseTableNumber(["12"]), 12);
});

test("parseTableNumber rejects missing, invalid, and unsafe values", () => {
  assert.equal(parseTableNumber(undefined), null);
  assert.equal(parseTableNumber("0"), null);
  assert.equal(parseTableNumber("-1"), null);
  assert.equal(parseTableNumber("2.5"), null);
  assert.equal(parseTableNumber("abc"), null);
  assert.equal(parseTableNumber("1000"), null);
});

test("parseTableContext reads a Mizane table UUID + label from t/tl", () => {
  assert.deepEqual(parseTableContext({ t: UUID, tl: "T1" }), {
    mizaneTableId: UUID,
    label: "T1",
  });
});

test("parseTableContext keeps the UUID even when the label is missing", () => {
  assert.deepEqual(parseTableContext({ t: UUID }), {
    mizaneTableId: UUID,
    label: null,
  });
});

test("parseTableContext ignores a non-UUID t and falls back to legacy number", () => {
  assert.deepEqual(parseTableContext({ t: "not-a-uuid", table: "7" }), {
    mizaneTableId: null,
    label: "7",
  });
});

test("parseTableContext maps a legacy numeric table to a label", () => {
  assert.deepEqual(parseTableContext({ table: "12" }), {
    mizaneTableId: null,
    label: "12",
  });
});

test("parseTableContext returns nulls when nothing is provided", () => {
  assert.deepEqual(parseTableContext({}), {
    mizaneTableId: null,
    label: null,
  });
});
