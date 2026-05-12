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
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
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
  ready: { next: "completed", label: "Terminer" },
};

export function canTransitionOrderStatus(
  current: OrderLifecycleStatus,
  next: OrderLifecycleStatus,
): boolean {
  return ORDER_STATUS_TRANSITIONS[current].includes(next);
}

export function isTerminalOrderStatus(status: OrderLifecycleStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status].length === 0;
}
