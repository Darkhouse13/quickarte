import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { getAppUrl, getCanonicalUrl, stripe } from "./stripe";
import type { StripeConnectStatus } from "./types";

/**
 * Creates an Express connected account for a business, stores the account id
 * on the businesses row, and returns it.
 *
 * We go with Express over Standard because non-technical boulangerie owners
 * aren't going to have a pre-existing Stripe account, and Stripe-hosted
 * onboarding is the lowest-friction path. See commit history for rationale.
 * Platform bears liability for chargebacks — accepted trade-off for v1.
 */
export type ConnectBusinessType = "individual" | "company";

export async function createConnectAccount(
  businessId: string,
  options: { businessType: ConnectBusinessType } = { businessType: "individual" },
): Promise<string> {
  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: {
      id: true,
      stripeAccountId: true,
      name: true,
      slug: true,
    },
  });
  if (!business) throw new Error(`Business ${businessId} not found`);

  if (business.stripeAccountId) return business.stripeAccountId;

  const account = await stripe().accounts.create({
    type: "express",
    country: "FR",
    email: undefined, // collected during Stripe-hosted onboarding
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: options.businessType,
    business_profile: {
      name: business.name,
      url: `${getCanonicalUrl()}/${business.slug}`,
      mcc: "5812", // eating places / restaurants
    },
    metadata: {
      business_id: business.id,
      business_slug: business.slug,
    },
    settings: {
      payouts: {
        schedule: { interval: "daily" },
      },
    },
  });

  await db
    .update(businesses)
    .set({
      stripeAccountId: account.id,
      stripeChargesEnabled: account.charges_enabled ?? false,
      stripePayoutsEnabled: account.payouts_enabled ?? false,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, business.id));

  return account.id;
}

/**
 * Creates a Stripe-hosted Account Link for Express onboarding. Account Links
 * are single-use and short-lived; generate fresh on every settings page view
 * where the button is displayed.
 */
export async function createOnboardingLink(
  businessId: string,
): Promise<string> {
  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: { stripeAccountId: true },
  });
  if (!business?.stripeAccountId) {
    throw new Error(`Business ${businessId} has no Stripe account yet`);
  }

  const appUrl = getAppUrl();
  const link = await stripe().accountLinks.create({
    account: business.stripeAccountId,
    refresh_url: `${appUrl}/settings?stripe=refresh`,
    return_url: `${appUrl}/settings?stripe=connected`,
    type: "account_onboarding",
  });
  return link.url;
}

/**
 * One-time login URL for the merchant's Express dashboard. Use on the "Voir
 * mon tableau de bord Stripe" button in settings.
 */
export async function createDashboardLoginLink(
  businessId: string,
): Promise<string> {
  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: { stripeAccountId: true },
  });
  if (!business?.stripeAccountId) {
    throw new Error(`Business ${businessId} has no Stripe account yet`);
  }
  const login = await stripe().accounts.createLoginLink(
    business.stripeAccountId,
  );
  return login.url;
}

/**
 * Pulls the current Stripe account state and writes any changed fields back
 * to the businesses row. Called from the `account.updated` webhook and from
 * the "Vérifier le statut" button in settings.
 */
export async function syncAccountStatus(
  businessId: string,
): Promise<StripeConnectStatus> {
  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: {
      id: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeOnboardingCompletedAt: true,
    },
  });
  if (!business) throw new Error(`Business ${businessId} not found`);
  if (!business.stripeAccountId) return { state: "not_connected" };

  const account = await stripe().accounts.retrieve(business.stripeAccountId);
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const detailsSubmitted = Boolean(account.details_submitted);

  const nowCompleted =
    business.stripeOnboardingCompletedAt === null &&
    chargesEnabled &&
    detailsSubmitted;

  await db
    .update(businesses)
    .set({
      stripeChargesEnabled: chargesEnabled,
      stripePayoutsEnabled: payoutsEnabled,
      stripeOnboardingCompletedAt: nowCompleted
        ? new Date()
        : business.stripeOnboardingCompletedAt,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, business.id));

  if (chargesEnabled) {
    return {
      state: "connected",
      accountId: business.stripeAccountId,
      chargesEnabled: true,
      payoutsEnabled,
      completedAt: nowCompleted
        ? new Date()
        : business.stripeOnboardingCompletedAt,
    };
  }
  return {
    state: "onboarding_incomplete",
    accountId: business.stripeAccountId,
    chargesEnabled: false,
    payoutsEnabled,
  };
}

/**
 * Given a Stripe account, find the business that owns it. Used by
 * `account.updated` webhook, which only gets the account id.
 */
export async function findBusinessByStripeAccountId(
  accountId: string,
): Promise<{ id: string } | null> {
  const row = await db.query.businesses.findFirst({
    where: eq(businesses.stripeAccountId, accountId),
    columns: { id: true },
  });
  return row ?? null;
}

/**
 * Read-only status for UI rendering. Doesn't hit Stripe; just reads our
 * cached flags. Settings page uses this for the initial render.
 */
export async function getConnectStatus(
  businessId: string,
): Promise<StripeConnectStatus> {
  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: {
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeOnboardingCompletedAt: true,
    },
  });
  if (!business?.stripeAccountId) return { state: "not_connected" };
  if (business.stripeChargesEnabled) {
    return {
      state: "connected",
      accountId: business.stripeAccountId,
      chargesEnabled: true,
      payoutsEnabled: business.stripePayoutsEnabled,
      completedAt: business.stripeOnboardingCompletedAt,
    };
  }
  return {
    state: "onboarding_incomplete",
    accountId: business.stripeAccountId,
    chargesEnabled: false,
    payoutsEnabled: business.stripePayoutsEnabled,
  };
}

// Type-only re-export for callers that need the raw Stripe.Account type.
export type StripeAccount = Stripe.Account;
