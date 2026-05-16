import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { staffMembers, type StaffMember } from "@quickarte/db-schema";

export type StaffRole = "owner" | "manager" | "waiter" | "kitchen" | "cashier";

export type ProtectedResource =
  | "catalog"
  | "orders.dashboard"
  | "orders.status_update"
  | "orders.mark_served"
  | "orders.mark_paid"
  | "orders.pos_reconciliation"
  | "orders.print"
  | "close_of_day"
  | "kitchen.queue"
  | "kitchen.mark_prepared"
  | "settings"
  | "settings.billing.read"
  | "settings.billing.write"
  | "exports"
  | "staff";

const permissions: Record<StaffRole, ReadonlySet<ProtectedResource>> = {
  owner: new Set([
    "catalog",
    "orders.dashboard",
    "orders.status_update",
    "orders.mark_served",
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
  ]),
  manager: new Set([
    "catalog",
    "orders.dashboard",
    "orders.status_update",
    "orders.mark_served",
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
  ]),
  waiter: new Set(["orders.dashboard", "orders.status_update", "orders.mark_served"]),
  kitchen: new Set(["kitchen.queue", "kitchen.mark_prepared"]),
  cashier: new Set([
    "orders.dashboard",
    "orders.mark_served",
    "orders.mark_paid",
    "orders.pos_reconciliation",
    "orders.print",
    "close_of_day",
  ]),
};

export function canAccess(
  role: StaffRole,
  resource: ProtectedResource,
): boolean {
  return permissions[role].has(resource);
}

export function assertPermission(
  role: StaffRole,
  resource: ProtectedResource,
): void {
  if (!canAccess(role, resource)) {
    throw new Error(`Role ${role} cannot access ${resource}`);
  }
}

export async function getStaffRole(
  userId: string,
  businessId: string,
): Promise<StaffRole | null> {
  const member = await db.query.staffMembers.findFirst({
    where: and(
      eq(staffMembers.userId, userId),
      eq(staffMembers.businessId, businessId),
      isNull(staffMembers.revokedAt),
    ),
    columns: { role: true },
  });
  return member?.role ?? null;
}

export async function getStaffMember(
  userId: string,
  businessId: string,
): Promise<StaffMember | null> {
  const member = await db.query.staffMembers.findFirst({
    where: and(
      eq(staffMembers.userId, userId),
      eq(staffMembers.businessId, businessId),
      isNull(staffMembers.revokedAt),
    ),
  });
  return member ?? null;
}

export async function assertRole(
  userId: string,
  businessId: string,
  allowed: StaffRole[],
): Promise<StaffRole> {
  const role = await getStaffRole(userId, businessId);
  if (!role || !allowed.includes(role)) {
    throw new Error("Forbidden");
  }
  return role;
}

export function rolesForResource(resource: ProtectedResource): StaffRole[] {
  return (Object.keys(permissions) as StaffRole[]).filter((role) =>
    canAccess(role, resource),
  );
}
