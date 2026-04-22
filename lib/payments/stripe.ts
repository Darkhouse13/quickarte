import Stripe from "stripe";
import { env } from "@/lib/env";

declare global {
  var __quickarteStripe: Stripe | undefined;
}

function createClient(): Stripe {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set — Stripe integration disabled",
    );
  }
  return new Stripe(key, {
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
    telemetry: false,
    appInfo: {
      name: "Quickarte",
      version: "0.1.0",
    },
  });
}

export function stripe(): Stripe {
  if (!globalThis.__quickarteStripe) {
    globalThis.__quickarteStripe = createClient();
  }
  return globalThis.__quickarteStripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function getPublishableKey(): string | undefined {
  return env.STRIPE_PUBLISHABLE_KEY;
}

export function getPlatformFeeBps(): number {
  return env.QUICKARTE_PLATFORM_FEE_BPS;
}

export function getWebhookSecret(): string {
  const s = env.STRIPE_WEBHOOK_SECRET;
  if (!s) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return s;
}

export function getAppUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

// Public hostname used anywhere a URL crosses into a third party that
// validates reachability (Stripe business_profile.url, email links, etc.).
// NEXT_PUBLIC_APP_URL is allowed to be localhost in dev; this one must not.
export function getCanonicalUrl(): string {
  return env.NEXT_PUBLIC_CANONICAL_URL.replace(/\/$/, "");
}
