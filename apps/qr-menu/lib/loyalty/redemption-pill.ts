// Single source of truth for "should this merchant-side surface flag the
// order as a credit redemption?". Used by the kitchen board and the
// /orders row to keep the visual cue consistent. Kept as a pure predicate
// so it can be unit-tested without React.
export function shouldShowRedemptionPill(order: {
  paymentMode?: string | null;
}): boolean {
  return order.paymentMode === "credits";
}
