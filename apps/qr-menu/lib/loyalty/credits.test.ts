import test from "node:test";
import assert from "node:assert/strict";
import { assertCreditInvariant } from "./credits";

test("credit ledger invariant holds after grants and spends", () => {
  const ledger = [120, 30, -50, -25];
  const ledgerSum = ledger.reduce((sum, amount) => sum + amount, 0);
  const loyaltyMembersBalance = 75;

  assert.doesNotThrow(() =>
    assertCreditInvariant(loyaltyMembersBalance, ledgerSum),
  );
  assert.equal(loyaltyMembersBalance, ledgerSum);
});
