import type { StaffRole } from "@/lib/identity/permissions";

export type OrderLifecycleStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "served"
  | "paid"
  | "completed" // legacy terminal — use "served" → "paid" for new orders
  | "cancelled";

export const ORDER_STATUS_TRANSITIONS: Record<
  OrderLifecycleStatus,
  OrderLifecycleStatus[]
> = {
  pending: ["confirmed", "preparing", "cancelled"],
  confirmed: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "completed", "cancelled"], // "completed" kept for legacy compat
  served: ["paid", "cancelled"],
  paid: [],
  completed: [],
  cancelled: [],
};

export const PRIMARY_ORDER_ACTIONS: Partial<
  Record<OrderLifecycleStatus, { next: OrderLifecycleStatus; label: string }>
> = {
  pending: { next: "confirmed", label: "Confirmer" },
  confirmed: { next: "preparing", label: "Préparer" },
  preparing: { next: "ready", label: "Prêt" },
};

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

export const ACTIVE_POS_STATUSES: OrderLifecycleStatus[] = [
  "confirmed",
  "preparing",
  "ready",
  "served",
];

export const GARCON_PENDING_STATUSES: OrderLifecycleStatus[] = ["pending"];
export const GARCON_READY_STATUSES: OrderLifecycleStatus[] = ["ready"];
