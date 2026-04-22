import { and, eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { businesses, orders } from "@/lib/db/schema";
import { getPublishableKey, getPlatformFeeBps, stripe } from "./stripe";
import {
  amountToCents,
  computePlatformFeeCents,
  type CreatePaymentIntentInput,
  type CreatePaymentIntentResult,
} from "./types";

/**
 * Creates a PaymentIntent for a merchant order using a destination charge:
 * the customer pays on our platform account, Stripe takes its processing fee,
 * and the remainder settles into the merchant's connected account via
 * `transfer_data.destination`. Quickarte's pricing model is subscription-only,
 * so `application_fee_amount` is left off unless someone explicitly configures
 * a non-zero `QUICKARTE_PLATFORM_FEE_BPS`.
 *
 * Idempotent on the order id: if the order already has a payment intent
 * recorded, we fetch and reuse it instead of creating a duplicate. This
 * protects against double-click / retry on the client.
 */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<CreatePaymentIntentResult> {
  try {
    return await createPaymentIntentImpl(input);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "stripe-payment-intent" },
      extra: {
        orderId: input.orderId,
        businessId: input.businessId,
      },
    });
    throw err;
  }
}

async function createPaymentIntentImpl(
  input: CreatePaymentIntentInput,
): Promise<CreatePaymentIntentResult> {
  const { orderId, businessId, amount } = input;
  const currency = input.currency ?? "eur";

  const publishableKey = getPublishableKey();
  if (!publishableKey) {
    throw new Error(
      "STRIPE_PUBLISHABLE_KEY is not set — cannot render Payment Element",
    );
  }

  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: {
      stripeAccountId: true,
      stripeChargesEnabled: true,
    },
  });
  if (!business?.stripeAccountId || !business.stripeChargesEnabled) {
    throw new Error(
      `Business ${businessId} has no active Stripe account — cannot charge`,
    );
  }

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.businessId, businessId)),
    columns: {
      id: true,
      stripePaymentIntentId: true,
      paymentStatus: true,
    },
  });
  if (!order) throw new Error(`Order ${orderId} not found`);

  // Reuse existing intent if we've already created one for this order.
  if (order.stripePaymentIntentId) {
    const existing = await stripe().paymentIntents.retrieve(
      order.stripePaymentIntentId,
    );
    if (existing.status !== "canceled") {
      if (!existing.client_secret) {
        throw new Error("Existing PaymentIntent has no client_secret");
      }
      return {
        clientSecret: existing.client_secret,
        publishableKey,
        paymentIntentId: existing.id,
      };
    }
    // If it was canceled, fall through and create a fresh one below.
  }

  const amountCents = amountToCents(amount);
  const feeBps = getPlatformFeeBps();
  const applicationFeeCents = computePlatformFeeCents(amountCents, feeBps);

  const intent = await stripe().paymentIntents.create(
    {
      amount: amountCents,
      currency,
      automatic_payment_methods: { enabled: true },
      // Quickarte does not skim a percentage: when the fee is 0 we omit the
      // field entirely so the PaymentIntent is unambiguously fee-free.
      ...(applicationFeeCents > 0
        ? { application_fee_amount: applicationFeeCents }
        : {}),
      transfer_data: { destination: business.stripeAccountId },
      metadata: {
        order_id: orderId,
        business_id: businessId,
        platform_fee_bps: String(feeBps),
      },
    },
    {
      // Natural idempotency key: same order → same intent.
      idempotencyKey: `pi-create-${orderId}`,
    },
  );

  await db
    .update(orders)
    .set({
      stripePaymentIntentId: intent.id,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  if (!intent.client_secret) {
    throw new Error("Stripe returned a PaymentIntent without client_secret");
  }

  return {
    clientSecret: intent.client_secret,
    publishableKey,
    paymentIntentId: intent.id,
  };
}
