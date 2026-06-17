import {
  ORDER_STATUS_TRANSITIONS,
  type OrderLifecycleStatus,
} from "@/lib/ordering/status";
import type { MizaneFulfillment, MizaneOrderStatus } from "./types";

// Pure mapping between Mizane's order status/fulfillment and the QuickArte
// lifecycle. Kept free of DB/server-only imports so it is unit-testable; the
// I/O (transitions, polling) lives in order-sync.ts.

// QuickArte statuses an online order can still progress FROM — only these are
// polled (terminal orders are done).
export const ONLINE_ACTIVE_STATUSES: OrderLifecycleStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
];

// Rank = forward position in the online flow; the reconcile only ever advances
// along it, never backward. (served/paid are unused online — `paid` maps to the
// terminal `completed`.)
const ONLINE_STATUS_RANK: Partial<Record<OrderLifecycleStatus, number>> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  completed: 4,
};

/**
 * Map a Mizane (status, fulfillment) to the QuickArte lifecycle target, or null
 * for "nothing to do yet" (still pending, or folded into another order).
 *
 *   rejected                      → cancelled
 *   confirmed + in_progress       → preparing
 *   confirmed + served            → ready
 *   confirmed + paid | unpaid     → completed (done)
 *   confirmed + voided | refunded → cancelled
 *   confirmed + merged            → null (leave where it is)
 *   confirmed + (none)            → confirmed (older Mizane, no downstream field)
 *
 * Unknown fulfillment values are tolerated as "in progress" → preparing
 * (forward-compat, matching the contract's client guidance).
 */
export function mizaneTargetStatus(
  status: MizaneOrderStatus,
  fulfillment?: MizaneFulfillment,
): OrderLifecycleStatus | null {
  if (status === "rejected") return "cancelled";
  if (status !== "confirmed") return null; // pending_confirmation / unknown

  switch (fulfillment) {
    case undefined:
      return "confirmed";
    case "served":
      return "ready";
    case "paid":
    case "unpaid":
      return "completed";
    case "voided":
    case "refunded":
      return "cancelled";
    case "merged":
      return null;
    case "in_progress":
    default:
      return "preparing";
  }
}

/**
 * The next single step from `current` toward `target` along the online flow: the
 * highest-ranked allowed successor (per ORDER_STATUS_TRANSITIONS) that doesn't
 * overshoot the target. Null when `current` is already at/beyond `target`, so a
 * caller can loop until it returns null. Lets the reconcile cross a multi-stage
 * jump (e.g. pending → ready) using only valid transitions.
 */
export function nextStepToward(
  current: OrderLifecycleStatus,
  target: OrderLifecycleStatus,
): OrderLifecycleStatus | null {
  const currentRank = ONLINE_STATUS_RANK[current];
  const targetRank = ONLINE_STATUS_RANK[target];
  if (currentRank === undefined || targetRank === undefined) return null;
  if (targetRank <= currentRank) return null;

  let best: OrderLifecycleStatus | null = null;
  let bestRank = currentRank;
  for (const candidate of ORDER_STATUS_TRANSITIONS[current]) {
    const rank = ONLINE_STATUS_RANK[candidate];
    if (rank === undefined) continue;
    if (rank > bestRank && rank <= targetRank) {
      best = candidate;
      bestRank = rank;
    }
  }
  return best;
}
