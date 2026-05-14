import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccess,
  type ProtectedResource,
  type StaffRole,
} from "./permissions";

const roles: StaffRole[] = ["owner", "manager", "waiter", "kitchen", "cashier"];
const resources: ProtectedResource[] = [
  "catalog",
  "orders.dashboard",
  "orders.status_update",
  "orders.mark_paid",
  "orders.pos_reconciliation",
  "orders.print",
  "close_of_day",
  "kitchen.queue",
  "kitchen.mark_prepared",
  "settings",
  "settings.billing.read",
  "settings.billing.write",
  "exports",
  "staff",
];

const allowed: Record<StaffRole, ProtectedResource[]> = {
  owner: resources,
  manager: [
    "catalog",
    "orders.dashboard",
    "orders.status_update",
    "orders.mark_paid",
    "orders.pos_reconciliation",
    "orders.print",
    "close_of_day",
    "kitchen.queue",
    "kitchen.mark_prepared",
    "settings",
    "settings.billing.read",
    "exports",
    "staff",
  ],
  waiter: ["orders.dashboard", "orders.status_update"],
  kitchen: ["kitchen.queue", "kitchen.mark_prepared"],
  cashier: [
    "orders.dashboard",
    "orders.mark_paid",
    "orders.pos_reconciliation",
    "orders.print",
    "close_of_day",
  ],
};

for (const role of roles) {
  for (const resource of resources) {
    test(`${role} ${allowed[role].includes(resource) ? "can" : "cannot"} access ${resource}`, () => {
      assert.equal(canAccess(role, resource), allowed[role].includes(resource));
    });
  }
}
