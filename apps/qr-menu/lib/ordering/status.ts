import type { StaffRole } from "@/lib/identity/permissions";

export type OrderLifecycleStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export const ORDER_STATUS_TRANSITIONS: Record<
  OrderLifecycleStatus,
  OrderLifecycleStatus[]
> = {
  pending: ["confirmed", "preparing", "cancelled"],
  confirmed: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const PRIMARY_ORDER_ACTIONS: Partial<
  Record<OrderLifecycleStatus, { next: OrderLifecycleStatus; label: string }>
> = {
  pending: { next: "confirmed", label: "Confirmer" },
  confirmed: { next: "preparing", label: "Pr\u00e9parer" },
  preparing: { next: "ready", label: "Pr\u00eat" },
};

// `ready` orders are served from the floor via the SERVIR button, which calls
// the dedicated `markOrderServed` action \u2014 the only path to the served state.
// Roles mirror that action's gate (kitchen marks ready, the floor marks served).
const SERVIR_BUTTON_ROLES: ReadonlySet<StaffRole> = new Set<StaffRole>([
  "owner",
  "manager",
  "waiter",
  "cashier",
]);

export function canShowServirButton(
  status: OrderLifecycleStatus,
  role: StaffRole,
): boolean {
  return status === "ready" && SERVIR_BUTTON_ROLES.has(role);
}

export function canTransitionOrderStatus(
  current: OrderLifecycleStatus,
  next: OrderLifecycleStatus,
): boolean {
  return ORDER_STATUS_TRANSITIONS[current].includes(next);
}

export function isTerminalOrderStatus(status: OrderLifecycleStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status].length === 0;
}
