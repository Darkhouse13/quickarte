import test from "node:test";
import assert from "node:assert/strict";
import type { StaffRole } from "@/lib/identity/permissions";
import { canAccessCloseOfDay } from "./close-of-day-access";

const expectations: Record<StaffRole, boolean> = {
  owner: true,
  manager: true,
  cashier: true,
  waiter: false,
  kitchen: false,
};

for (const [role, allowed] of Object.entries(expectations) as Array<
  [StaffRole, boolean]
>) {
  test(`${role} ${allowed ? "can" : "cannot"} access close of day`, () => {
    assert.equal(canAccessCloseOfDay(role), allowed);
  });
}
