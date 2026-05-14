import test from "node:test";
import assert from "node:assert/strict";
import { generateCustomerAccessToken } from "./customer-token";

test("generates unique 24-byte base64url customer access tokens", () => {
  const tokens = new Set(
    Array.from({ length: 200 }, () => generateCustomerAccessToken()),
  );
  assert.equal(tokens.size, 200);
  for (const token of tokens) {
    assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  }
});
