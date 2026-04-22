export type StripeConnectStatus =
  | { state: "not_connected" }
  | {
      state: "onboarding_incomplete";
      accountId: string;
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
    }
  | {
      state: "connected";
      accountId: string;
      chargesEnabled: true;
      payoutsEnabled: boolean;
      completedAt: Date | null;
    };

export type CreatePaymentIntentInput = {
  orderId: string;
  businessId: string;
  amount: number; // in major currency units (e.g. euros)
  currency?: "eur";
};

export type CreatePaymentIntentResult = {
  clientSecret: string;
  publishableKey: string;
  paymentIntentId: string;
};

export function amountToCents(amount: number): number {
  // Stripe wants integer minor units. Round half-up to avoid sub-cent drift
  // introduced by numeric(10,2) ↔ JS number conversions.
  return Math.round(amount * 100);
}

export function computePlatformFeeCents(
  amountCents: number,
  feeBps: number,
): number {
  // basis points → fraction; integer cents out.
  return Math.floor((amountCents * feeBps) / 10_000);
}
