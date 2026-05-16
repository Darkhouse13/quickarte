import assert from "node:assert/strict";
import test from "node:test";
import {
  multiSelectControlsVisible,
  optionConfigIncomplete,
  reorder,
  validateOptionMinMax,
} from "./option-editor-logic";

test("min/max validator rejects max below min", () => {
  const result = validateOptionMinMax(3, 0);
  assert.equal(result.valid, false);
});

test("min/max validator accepts unlimited max", () => {
  assert.equal(validateOptionMinMax(0, null).valid, true);
  assert.equal(validateOptionMinMax(3, null).valid, true);
});

test("min/max validator rejects a negative minimum", () => {
  assert.equal(validateOptionMinMax(-1, null).valid, false);
});

test("min/max validator accepts equal min and max", () => {
  assert.equal(validateOptionMinMax(2, 2).valid, true);
});

test("min/max validator accepts an empty minimum", () => {
  assert.equal(validateOptionMinMax(null, 4).valid, true);
});

test("option is incomplete when single-select has no values", () => {
  assert.equal(
    optionConfigIncomplete({
      type: "single_select",
      required: false,
      values: [],
    }),
    true,
  );
});

test("option is incomplete when required multi-select has no values", () => {
  assert.equal(
    optionConfigIncomplete({
      type: "multi_select",
      required: true,
      values: [],
    }),
    true,
  );
});

test("optional multi-select with no values is not incomplete", () => {
  assert.equal(
    optionConfigIncomplete({
      type: "multi_select",
      required: false,
      values: [],
    }),
    false,
  );
});

test("option with values is never incomplete", () => {
  assert.equal(
    optionConfigIncomplete({
      type: "single_select",
      required: true,
      values: [{ id: "v1" }],
    }),
    false,
  );
});

test("min/max controls are only visible for multi-select", () => {
  assert.equal(multiSelectControlsVisible("multi_select"), true);
  assert.equal(multiSelectControlsVisible("single_select"), false);
});

test("reorder swaps neighbours and refuses out-of-bounds moves", () => {
  assert.deepEqual(reorder(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
  assert.deepEqual(reorder(["a", "b", "c"], 2, 1), null);
  assert.deepEqual(reorder(["a", "b", "c"], 0, -1), null);
});
