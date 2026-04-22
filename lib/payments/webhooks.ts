import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, stripeEvents } from "@/lib/db/schema";
import { getWebhookSecret, stripe } from "./stripe";
import { findBusinessByStripeAccountId, syncAccountStatus } from "./connect";

export type WebhookResult =
  | { status: "ok"; eventId: string; type: string }
  | { status: "duplicate"; eventId: string }
  | { status: "ignored"; eventId: string; type: string }
  | { status: "invalid_signature" };

/**
 * Verifies the Stripe signature and dispatches to a handler. Idempotent by
 * insert-or-skip on `stripe_events`: if the same event arrives twice Stripe
 * gets a 200 back but we don't re-process.
 *
 * Caller must pass the raw request body (bytes preserved). Next.js text()
 * over req.text() preserves it; JSON.parse round-trip does NOT.
 */
export async function handleWebhook(
  rawBody: string,
  signatureHeader: string | null,
): Promise<WebhookResult> {
  if (!signatureHeader) return { status: "invalid_signature" };

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      rawBody,
      signatureHeader,
      getWebhookSecret(),
    );
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return { status: "invalid_signature" };
  }

  // Insert-or-skip dedupe. Return `duplicate` only when we've *already* seen
  // this event id — lets Stripe know we've handled it so it stops retrying.
  try {
    await db.insert(stripeEvents).values({
      id: event.id,
      type: event.type,
      payloadJson: event as unknown as Record<string, unknown>,
    });
  } catch (err) {
    // Unique-violation on PK → we've seen it. Any other insert error we
    // surface, because we don't want to silently skip events for the wrong
    // reason. Drizzle wraps the pg error: authoritative code/constraint live
    // on err.cause; we fall back to a message match if the wrapping shape
    // ever changes.
    const cause = (err as { cause?: { code?: string; constraint?: string } })
      ?.cause;
    const msg = String((err as { message?: string })?.message ?? "");
    const isDuplicate =
      cause?.code === "23505" ||
      cause?.constraint === "stripe_events_pkey" ||
      msg.includes("duplicate key") ||
      msg.includes("unique constraint") ||
      msg.includes("23505");
    if (isDuplicate) {
      console.info("[stripe-webhook] dedupe hit", {
        eventId: event.id,
        type: event.type,
      });
      return { status: "duplicate", eventId: event.id };
    }
    throw err;
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await onPaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        return { status: "ok", eventId: event.id, type: event.type };

      case "payment_intent.payment_failed":
        await onPaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        return { status: "ok", eventId: event.id, type: event.type };

      case "charge.refunded":
        await onChargeRefunded(event.data.object as Stripe.Charge);
        return { status: "ok", eventId: event.id, type: event.type };

      case "account.updated":
        await onAccountUpdated(event.data.object as Stripe.Account);
        return { status: "ok", eventId: event.id, type: event.type };

      default:
        return { status: "ignored", eventId: event.id, type: event.type };
    }
  } catch (err) {
    // Event row already persisted above; rethrow so the route returns 500
    // and Stripe retries. The next attempt will hit the duplicate-key path
    // on the insert but we need to actually process it — so delete the
    // placeholder row first to let the retry re-enter the handler.
    await db.delete(stripeEvents).where(eq(stripeEvents.id, event.id));
    throw err;
  }
}

async function onPaymentIntentSucceeded(
  intent: Stripe.PaymentIntent,
): Promise<void> {
  const orderId = intent.metadata?.order_id;
  if (!orderId) {
    console.warn(
      `[stripe-webhook] payment_intent.succeeded missing order_id metadata:`,
      intent.id,
    );
    return;
  }

  const chargeId = extractChargeId(intent);

  await db
    .update(orders)
    .set({
      paymentStatus: "paid",
      stripeChargeId: chargeId,
      // Paid orders always have a concrete fee (0 in our current pricing model). Null is reserved for orders that never paid.
      platformFeeCents: intent.application_fee_amount ?? 0,
      paidAt: new Date(intent.created * 1000),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));
}

async function onPaymentIntentFailed(
  intent: Stripe.PaymentIntent,
): Promise<void> {
  const orderId = intent.metadata?.order_id;
  if (!orderId) return;

  // Stripe fires payment_failed late when an earlier attempt failed on a PI
  // that eventually succeeded. Always re-check the authoritative PI status
  // before marking an order failed.
  const current = await stripe().paymentIntents.retrieve(intent.id);
  if (current.status === "succeeded" || current.status === "processing") {
    console.info("[stripe-webhook] payment_failed ignored, PI now", {
      paymentIntentId: intent.id,
      status: current.status,
    });
    return;
  }

  await db
    .update(orders)
    .set({ paymentStatus: "failed", updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

async function onChargeRefunded(charge: Stripe.Charge): Promise<void> {
  // Prefer metadata on the intent (we set it at creation). Fall back to the
  // charge's metadata if the intent isn't expanded.
  const metaOrderId =
    (typeof charge.payment_intent === "object" &&
      charge.payment_intent?.metadata?.order_id) ||
    charge.metadata?.order_id;

  if (metaOrderId) {
    await db
      .update(orders)
      .set({ paymentStatus: "refunded", updatedAt: new Date() })
      .where(eq(orders.id, metaOrderId));
    return;
  }

  // Last-ditch: match by stripe_charge_id set at success time.
  if (charge.id) {
    await db
      .update(orders)
      .set({ paymentStatus: "refunded", updatedAt: new Date() })
      .where(eq(orders.stripeChargeId, charge.id));
  }
}

async function onAccountUpdated(account: Stripe.Account): Promise<void> {
  const biz = await findBusinessByStripeAccountId(account.id);
  if (!biz) {
    console.warn(
      `[stripe-webhook] account.updated for unknown account:`,
      account.id,
    );
    return;
  }
  await syncAccountStatus(biz.id);
}

function extractChargeId(intent: Stripe.PaymentIntent): string | null {
  // `latest_charge` can be a string id or an expanded Charge object.
  const latest = intent.latest_charge;
  if (typeof latest === "string") return latest;
  if (latest && typeof latest === "object" && "id" in latest) return latest.id;
  return null;
}
