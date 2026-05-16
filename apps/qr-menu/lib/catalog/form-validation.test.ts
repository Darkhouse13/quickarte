import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_REQUIRED_MESSAGE,
  validateCategorySelection,
} from "./form-validation";

test("validateCategorySelection flags a missing category with a typed code", () => {
  const result = validateCategorySelection("");
  assert.notEqual(result, null);
  assert.equal(result?.code, "CATEGORY_REQUIRED");
  assert.equal(result?.message, CATEGORY_REQUIRED_MESSAGE);
});

test("validateCategorySelection treats a whitespace-only id as missing", () => {
  assert.equal(validateCategorySelection("   ")?.code, "CATEGORY_REQUIRED");
});

test("validateCategorySelection clears once a category id is present", () => {
  assert.equal(
    validateCategorySelection("11111111-1111-4111-8111-111111111111"),
    null,
  );
});
