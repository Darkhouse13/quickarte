export const ACCRUAL_TYPES = ["per_visit", "per_euro"] as const;
export type AccrualType = (typeof ACCRUAL_TYPES)[number];

export const LOYALTY_SOURCES = [
  "online_order",
  "manual_in_person",
  "admin_adjust",
] as const;
export type LoyaltySource = (typeof LOYALTY_SOURCES)[number];

export const LOYALTY_TX_TYPES = ["earn", "redeem", "adjust"] as const;
export type LoyaltyTxType = (typeof LOYALTY_TX_TYPES)[number];

export function isAccrualType(value: string): value is AccrualType {
  return (ACCRUAL_TYPES as readonly string[]).includes(value);
}

export function isLoyaltySource(value: string): value is LoyaltySource {
  return (LOYALTY_SOURCES as readonly string[]).includes(value);
}
