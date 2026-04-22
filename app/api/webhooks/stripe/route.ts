import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { handleWebhook } from "@/lib/payments/webhooks";

// Must stay dynamic: each webhook delivery is a live request from Stripe.
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // stripe Node SDK needs Node runtime

export async function POST(req: NextRequest) {
  // req.text() preserves the raw bytes needed for signature verification.
  // DO NOT swap this for req.json() — that re-serializes and breaks the HMAC.
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  try {
    const result = await handleWebhook(rawBody, signature);

    if (result.status === "invalid_signature") {
      return new NextResponse("invalid signature", { status: 400 });
    }
    if (result.status === "duplicate") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    // Any non-signature failure is a real error worth escalating. We let it
    // bubble so Stripe retries (see handleWebhook for the placeholder-row
    // cleanup that makes the retry idempotent).
    Sentry.captureException(err, { tags: { area: "stripe-webhook" } });
    throw err;
  }
}
