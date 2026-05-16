"use server";

import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth/get-business";
import { db } from "@/lib/db";
import {
  businessSettings,
  businesses,
  googleReviewGrants,
  loyaltyMembers,
  loyaltyPrograms,
  orderItems,
  orders,
  products,
  redemptionListings,
} from "@/lib/db/schema";
import { hasEntitlement, requireEntitlement } from "@/lib/entitlements/queries";
import { env } from "@/lib/env";
import { assertRole } from "@/lib/identity/permissions";
import { recordOrderEvent } from "@/lib/ordering/events";
import { generateCustomerAccessToken } from "@/lib/ordering/customer-token";
import { enqueuePrintJobsForOrder } from "@/lib/printing/pipeline";
import { normalizeMoroccanPhone } from "@/lib/utils/phone";
import {
  applyCreditTransaction,
  getCreditBalance,
  getCreditLedger,
  InsufficientCreditsError,
} from "@/lib/loyalty/credits";
import {
  fetchRecentGoogleReviews,
  matchReviewByDisplayName,
} from "@/lib/loyalty/google-reviews";

type ActionResult<T> =
  | { status: "success"; data: T }
  | { status: "error"; code: string; message: string };

const OWNER_MANAGER = ["owner", "manager"] as const;

const creditProgramSettingsSchema = z.object({
  businessId: z.string().uuid(),
  creditLabel: z.string().trim().min(1).max(40),
  accrualPerMad: z.number().min(0).max(100),
  minOrderForAccrualMad: z.number().min(0).max(100000),
  reviewRewardEnabled: z.boolean(),
  creditsPerReview: z.number().int().min(0).max(10000),
  reviewMaxAgeDays: z.number().int().min(1).max(365),
  redemptionEnabled: z.boolean(),
  minBalanceToRedeem: z.number().int().min(0).max(1000000),
  enabled: z.boolean().optional(),
});

export async function updateCreditProgramSettings(
  input: z.input<typeof creditProgramSettingsSchema>,
): Promise<ActionResult<{ businessId: string }>> {
  const parsed = creditProgramSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", code: "VALIDATION_ERROR", message: "Parametres invalides." };
  }
  const { session } = await requireBusiness();
  await assertRole(session.user.id, parsed.data.businessId, [...OWNER_MANAGER]);
  await requireEntitlement(parsed.data.businessId, "loyalty");

  if (parsed.data.reviewRewardEnabled) {
    const settings = await db.query.businessSettings.findFirst({
      where: eq(businessSettings.businessId, parsed.data.businessId),
      columns: { googlePlaceId: true },
    });
    const missing = [
      !settings?.googlePlaceId?.trim() ? "l'identifiant Google Place" : null,
      !env.GOOGLE_PLACES_API_KEY ? "la cle API Google Places" : null,
    ].filter(Boolean);
    if (missing.length > 0) {
      return {
        status: "error",
        code: "GOOGLE_PLACES_PREREQUISITES_MISSING",
        message: `Impossible d'activer la verification Google : il manque ${missing.join(" et ")}.`,
      };
    }
  }

  const [row] = await db
    .insert(loyaltyPrograms)
    .values({
      businessId: parsed.data.businessId,
      loyaltyType: "credits",
      rewardThreshold: "1",
      rewardDescription: "Credits",
      creditLabel: parsed.data.creditLabel,
      accrualPerMad: parsed.data.accrualPerMad.toFixed(4),
      minOrderForAccrualMad: parsed.data.minOrderForAccrualMad.toFixed(2),
      reviewRewardEnabled: parsed.data.reviewRewardEnabled,
      creditsPerReview: parsed.data.creditsPerReview,
      reviewMaxAgeDays: parsed.data.reviewMaxAgeDays,
      redemptionEnabled: parsed.data.redemptionEnabled,
      minBalanceToRedeem: parsed.data.minBalanceToRedeem,
      enabled: parsed.data.enabled ?? true,
    })
    .onConflictDoUpdate({
      target: loyaltyPrograms.businessId,
      set: {
        loyaltyType: "credits",
        creditLabel: parsed.data.creditLabel,
        accrualPerMad: parsed.data.accrualPerMad.toFixed(4),
        minOrderForAccrualMad: parsed.data.minOrderForAccrualMad.toFixed(2),
        reviewRewardEnabled: parsed.data.reviewRewardEnabled,
        creditsPerReview: parsed.data.creditsPerReview,
        reviewMaxAgeDays: parsed.data.reviewMaxAgeDays,
        redemptionEnabled: parsed.data.redemptionEnabled,
        minBalanceToRedeem: parsed.data.minBalanceToRedeem,
        ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
        updatedAt: new Date(),
      },
    })
    .returning({ businessId: loyaltyPrograms.businessId });
  revalidatePath("/loyalty");
  return { status: "success", data: { businessId: row?.businessId ?? parsed.data.businessId } };
}

export async function updateGooglePlaceId(input: {
  businessId: string;
  googlePlaceId: string | null;
}): Promise<ActionResult<{ businessId: string }>> {
  const { session } = await requireBusiness();
  await assertRole(session.user.id, input.businessId, [...OWNER_MANAGER]);
  await requireEntitlement(input.businessId, "loyalty");
  await db
    .insert(businessSettings)
    .values({
      businessId: input.businessId,
      googlePlaceId: input.googlePlaceId?.trim() || null,
    })
    .onConflictDoUpdate({
      target: businessSettings.businessId,
      set: {
        googlePlaceId: input.googlePlaceId?.trim() || null,
        updatedAt: new Date(),
      },
    });
  revalidatePath("/loyalty");
  return { status: "success", data: { businessId: input.businessId } };
}

export async function createRedemptionListing(input: {
  businessId: string;
  productId: string;
  creditPrice: number;
}) {
  const { session } = await requireBusiness();
  await assertRole(session.user.id, input.businessId, [...OWNER_MANAGER]);
  await requireEntitlement(input.businessId, "loyalty");
  const [row] = await db
    .insert(redemptionListings)
    .values({
      businessId: input.businessId,
      productId: input.productId,
      creditPrice: input.creditPrice,
    })
    .onConflictDoNothing()
    .returning();
  if (row) return { status: "success" as const, data: row };
  const existing = await db.query.redemptionListings.findFirst({
    where: and(
      eq(redemptionListings.businessId, input.businessId),
      eq(redemptionListings.productId, input.productId),
    ),
  });
  if (!existing) {
    return { status: "error" as const, code: "NOT_FOUND", message: "Listing introuvable." };
  }
  return { status: "success" as const, data: existing };
}

export async function updateRedemptionListing(input: {
  listingId: string;
  creditPrice?: number;
  active?: boolean;
}) {
  const listing = await requireListingForMerchant(input.listingId);
  const [row] = await db
    .update(redemptionListings)
    .set({
      creditPrice: input.creditPrice ?? listing.creditPrice,
      active: input.active ?? listing.active,
      updatedAt: new Date(),
    })
    .where(eq(redemptionListings.id, input.listingId))
    .returning();
  revalidatePath("/loyalty");
  return { status: "success" as const, data: row };
}

export async function setRedemptionListingActive(input: {
  listingId: string;
  active: boolean;
}) {
  return updateRedemptionListing(input);
}

export async function reorderRedemptionListings(input: {
  businessId: string;
  orderedListingIds: string[];
}) {
  const { session } = await requireBusiness();
  await assertRole(session.user.id, input.businessId, [...OWNER_MANAGER]);
  await requireEntitlement(input.businessId, "loyalty");
  await db.transaction(async (tx) => {
    for (const [position, id] of input.orderedListingIds.entries()) {
      await tx
        .update(redemptionListings)
        .set({ position, updatedAt: new Date() })
        .where(
          and(
            eq(redemptionListings.id, id),
            eq(redemptionListings.businessId, input.businessId),
          ),
        );
    }
  });
  revalidatePath("/loyalty");
  return { status: "success" as const, data: { count: input.orderedListingIds.length } };
}

export async function deleteRedemptionListing(input: { listingId: string }) {
  await requireListingForMerchant(input.listingId);
  await db.delete(redemptionListings).where(eq(redemptionListings.id, input.listingId));
  revalidatePath("/loyalty");
  return { status: "success" as const, data: { listingId: input.listingId } };
}

export async function manualCreditGrant(input: {
  businessId: string;
  phoneRaw: string;
  amount: number;
  description?: string;
}) {
  const { session } = await requireBusiness();
  await assertRole(session.user.id, input.businessId, [...OWNER_MANAGER]);
  await requireEntitlement(input.businessId, "loyalty");
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return { status: "error" as const, code: "VALIDATION_ERROR", message: "Le montant doit etre positif." };
  }
  const txRow = await db.transaction((tx) =>
    applyCreditTransaction(
      {
        businessId: input.businessId,
        phoneRaw: input.phoneRaw,
        amount: input.amount,
        source: "manual_grant",
        description: input.description ?? "Credit manuel",
        actorUserId: session.user.id,
      },
      { tx },
    ),
  );
  return { status: "success" as const, data: txRow };
}

export async function manualCreditAdjustment(input: {
  businessId: string;
  phoneRaw: string;
  amount: number;
  description?: string;
}) {
  const { session } = await requireBusiness();
  await assertRole(session.user.id, input.businessId, [...OWNER_MANAGER]);
  await requireEntitlement(input.businessId, "loyalty");
  if (!Number.isInteger(input.amount) || input.amount >= 0) {
    return { status: "error" as const, code: "VALIDATION_ERROR", message: "L'ajustement doit etre negatif." };
  }
  const balance = await getCreditBalance(input.businessId, input.phoneRaw);
  const applied = Math.max(input.amount, -balance);
  if (applied === 0) {
    return { status: "success" as const, data: null };
  }
  const capped = applied !== input.amount;
  const description = `${input.description?.trim() || "Ajustement manuel"}${
    capped ? " (plafonne au solde disponible)" : ""
  }`;
  const txRow = await db.transaction((tx) =>
    applyCreditTransaction(
      {
        businessId: input.businessId,
        phoneRaw: input.phoneRaw,
        amount: applied,
        source: "manual_adjustment",
        description,
        actorUserId: session.user.id,
      },
      { tx },
    ),
  );
  return { status: "success" as const, data: txRow };
}

export async function getCreditCustomers(
  businessId: string,
  opts: { search?: string; limit?: number; offset?: number } = {},
) {
  const { session } = await requireBusiness();
  await assertRole(session.user.id, businessId, [...OWNER_MANAGER]);
  await requireEntitlement(businessId, "loyalty");
  const search = opts.search?.trim();
  const where = search
    ? and(
        eq(loyaltyMembers.businessId, businessId),
        ilike(loyaltyMembers.customerPhoneNormalized, `%${search}%`),
      )
    : eq(loyaltyMembers.businessId, businessId);
  return await db
    .select()
    .from(loyaltyMembers)
    .where(where)
    .orderBy(desc(loyaltyMembers.lastActivityAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

export async function getCustomerLedger(businessId: string, phoneRaw: string) {
  const { session } = await requireBusiness();
  await assertRole(session.user.id, businessId, [...OWNER_MANAGER]);
  await requireEntitlement(businessId, "loyalty");
  return getCreditLedger(businessId, phoneRaw, 200);
}

export async function getGoogleReviewGrants(
  businessId: string,
  opts: { limit?: number; offset?: number } = {},
) {
  const { session } = await requireBusiness();
  await assertRole(session.user.id, businessId, [...OWNER_MANAGER]);
  await requireEntitlement(businessId, "loyalty");
  return await db
    .select()
    .from(googleReviewGrants)
    .where(eq(googleReviewGrants.businessId, businessId))
    .orderBy(desc(googleReviewGrants.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

const attemptsByPhone = new Map<string, number[]>();
const REVIEW_NOT_FOUND_MESSAGE =
  "Nous n'avons pas encore trouve votre avis. Google peut prendre quelques minutes pour l'indexer. Reessayez dans 10 minutes.";

export async function claimGoogleReviewCredits(input: {
  businessSlug: string;
  phoneRaw: string;
  googleDisplayName: string;
}) {
  const phone = normalizeMoroccanPhone(input.phoneRaw);
  if (isRateLimited(phone)) {
    return {
      status: "error" as const,
      code: "RATE_LIMITED",
      message: "Trop de tentatives pour le moment. Reessayez dans une heure.",
    };
  }
  recordAttempt(phone);

  const business = await db.query.businesses.findFirst({
    where: eq(businesses.slug, input.businessSlug),
    columns: { id: true },
    with: {
      settings: { columns: { googlePlaceId: true } },
    },
  });
  if (!business) {
    return { status: "error" as const, code: "NOT_FOUND", message: "Commerce introuvable." };
  }
  if (!(await hasEntitlement(business.id, "loyalty"))) {
    return { status: "error" as const, code: "REVIEW_REWARD_DISABLED", message: "Cette recompense n'est pas activee." };
  }
  const program = await db.query.loyaltyPrograms.findFirst({
    where: eq(loyaltyPrograms.businessId, business.id),
  });
  if (!program?.enabled || program.loyaltyType !== "credits" || !program.reviewRewardEnabled) {
    return { status: "error" as const, code: "REVIEW_REWARD_DISABLED", message: "Cette recompense n'est pas activee." };
  }
  const placeId = business.settings?.googlePlaceId?.trim();
  if (!placeId) {
    return { status: "error" as const, code: "REVIEW_REWARD_DISABLED", message: "Cette recompense n'est pas activee." };
  }

  const reviews = await fetchRecentGoogleReviews(placeId);
  const review = matchReviewByDisplayName(
    reviews,
    input.googleDisplayName,
    program.reviewMaxAgeDays,
  );
  if (!review) {
    return { status: "error" as const, code: "REVIEW_NOT_FOUND", message: REVIEW_NOT_FOUND_MESSAGE };
  }

  const existingGrant = await db.query.googleReviewGrants.findFirst({
    where: and(
      eq(googleReviewGrants.businessId, business.id),
      eq(googleReviewGrants.googleReviewName, review.name),
    ),
    columns: { id: true },
  });
  if (existingGrant) {
    return { status: "error" as const, code: "REVIEW_ALREADY_CLAIMED", message: "Cet avis a deja ete credite." };
  }

  try {
    await db.transaction(async (tx) => {
      const creditTx = await applyCreditTransaction(
        {
          businessId: business.id,
          phoneRaw: phone,
          amount: program.creditsPerReview,
          source: "google_review",
          sourceRef: review.name,
          description: "Avis Google verifie",
        },
        { tx },
      );
      await tx.insert(googleReviewGrants).values({
        businessId: business.id,
        customerPhoneNormalized: phone,
        googleReviewName: review.name,
        googleAuthorDisplayName: review.authorAttribution.displayName,
        googleReviewPublishTime: new Date(review.publishTime),
        googleReviewRating: review.rating ?? null,
        creditTransactionId: creditTx.id,
      });
    });
  } catch {
    return { status: "error" as const, code: "REVIEW_ALREADY_CLAIMED", message: "Cet avis a deja ete credite." };
  }

  return {
    status: "success" as const,
    data: { balance: await getCreditBalance(business.id, phone) },
  };
}

/**
 * Public read for the customer-side redemption checkout's "Recharger" button.
 * Resolves the business by slug so the caller does not need to hold the id.
 * Treated as low-sensitivity: a malicious caller can already poll balances by
 * placing redemption orders, and the credit total alone is not exploitable.
 */
export async function getCustomerCreditBalance(input: {
  businessSlug: string;
  phoneRaw: string;
}): Promise<ActionResult<{ balance: number }>> {
  let phone: string;
  try {
    phone = normalizeMoroccanPhone(input.phoneRaw);
  } catch {
    return { status: "error", code: "VALIDATION_ERROR", message: "Numéro invalide." };
  }
  const business = await db.query.businesses.findFirst({
    where: eq(businesses.slug, input.businessSlug),
    columns: { id: true },
  });
  if (!business) {
    return { status: "error", code: "NOT_FOUND", message: "Commerce introuvable." };
  }
  if (!(await hasEntitlement(business.id, "loyalty"))) {
    return { status: "error", code: "LOYALTY_NOT_ENTITLED", message: "Le programme n'est pas actif." };
  }
  const balance = await getCreditBalance(business.id, phone);
  return { status: "success", data: { balance } };
}

export async function placeRedemptionOrder(input: {
  businessSlug: string;
  phoneRaw: string;
  items: { productId: string; quantity: number }[];
  notes?: string;
  type: "dine_in" | "takeaway";
  tableNumber?: string | number;
}) {
  const phone = normalizeMoroccanPhone(input.phoneRaw);
  const business = await db.query.businesses.findFirst({
    where: eq(businesses.slug, input.businessSlug),
    columns: { id: true, slug: true, locale: true },
    with: {
      settings: {
        columns: {
          posCoexistenceEnabled: true,
          dineInEnabled: true,
          takeawayEnabled: true,
        },
      },
    },
  });
  if (!business) {
    return { status: "error" as const, code: "NOT_FOUND", message: "Commerce introuvable." };
  }
  if (!(await hasEntitlement(business.id, "loyalty"))) {
    return { status: "error" as const, code: "LOYALTY_DISABLED", message: "Le programme n'est pas actif." };
  }
  const program = await db.query.loyaltyPrograms.findFirst({
    where: eq(loyaltyPrograms.businessId, business.id),
  });
  if (!program?.enabled || program.loyaltyType !== "credits" || !program.redemptionEnabled) {
    return { status: "error" as const, code: "REDEMPTION_DISABLED", message: "Les recompenses ne sont pas actives." };
  }
  if (input.type === "dine_in" && business.settings?.dineInEnabled === false) {
    return { status: "error" as const, code: "ORDER_TYPE_DISABLED", message: "Commande sur place desactivee." };
  }
  if (input.type === "takeaway" && business.settings?.takeawayEnabled === false) {
    return { status: "error" as const, code: "ORDER_TYPE_DISABLED", message: "Commande a emporter desactivee." };
  }

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const listings = await db.query.redemptionListings.findMany({
    where: and(
      eq(redemptionListings.businessId, business.id),
      inArray(redemptionListings.productId, productIds),
    ),
    with: { product: { columns: { id: true, name: true, available: true } } },
  });
  const listingByProductId = new Map(listings.map((l) => [l.productId, l]));
  const lines: {
    productId: string;
    quantity: number;
    creditUnitPrice: number;
    subtotalCredits: number;
  }[] = [];
  for (const item of input.items) {
    const listing = listingByProductId.get(item.productId);
    if (
      !listing?.active ||
      !listing.product?.available ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      return { status: "error" as const, code: "PRODUCT_NOT_REDEEMABLE", message: "Cet article n'est pas disponible en recompense." };
    }
    lines.push({
      productId: item.productId,
      quantity: item.quantity,
      creditUnitPrice: listing.creditPrice,
      subtotalCredits: listing.creditPrice * item.quantity,
    });
  }
  const creditsUsed = lines.reduce((sumValue, line) => sumValue + line.subtotalCredits, 0);
  const currentBalance = await getCreditBalance(business.id, phone);
  if (currentBalance < program.minBalanceToRedeem || currentBalance < creditsUsed) {
    return { status: "error" as const, code: "INSUFFICIENT_CREDITS", message: "Solde de credits insuffisant." };
  }

  try {
    const order = await db.transaction(async (tx) => {
      const customerAccessToken = generateCustomerAccessToken();
      const [insertedOrder] = await tx
        .insert(orders)
        .values({
          businessId: business.id,
          customerName: phone,
          customerPhone: phone,
          customerAccessToken,
          type: input.type,
          status: "pending",
          paymentMode: "credits",
          creditsUsed,
          posStatus: business.settings?.posCoexistenceEnabled ? "pending" : "not_required",
          total: "0.00",
          notes: input.notes?.trim() || null,
          tableNumber: input.type === "dine_in" && input.tableNumber ? String(input.tableNumber) : null,
        })
        .returning({ id: orders.id });
      if (!insertedOrder) throw new Error("Order insert failed");

      await tx.insert(orderItems).values(
        lines.map((line) => ({
          orderId: insertedOrder.id,
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: "0.00",
          creditUnitPrice: line.creditUnitPrice,
          subtotal: "0.00",
          optionsJson: null,
        })),
      );
      await applyCreditTransaction(
        {
          businessId: business.id,
          phoneRaw: phone,
          amount: -creditsUsed,
          source: "redemption",
          sourceRef: insertedOrder.id,
          description: "Commande en credits",
        },
        { tx },
      );
      await recordOrderEvent(insertedOrder.id, "order.created", {
        actor: { userId: null, role: "customer" },
        payload: {
          order_type: input.type,
          payment_mode: "credits",
          credits_used: creditsUsed,
          limitation: "Base product only; variants/options are not supported in credit redemption v1.",
        },
        tx,
      });
      return { id: insertedOrder.id, customerAccessToken };
    });
    void enqueuePrintJobsForOrder(order.id, business.id);
    return {
      status: "success" as const,
      data: {
        orderId: order.id,
        creditsUsed,
        customerUrl: `/${business.locale.split("-")[0] ?? "fr"}/o/${order.customerAccessToken}`,
      },
    };
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return { status: "error" as const, code: "INSUFFICIENT_CREDITS", message: err.message };
    }
    throw err;
  }
}

async function requireListingForMerchant(listingId: string) {
  const listing = await db.query.redemptionListings.findFirst({
    where: eq(redemptionListings.id, listingId),
  });
  if (!listing) throw new Error("Listing introuvable");
  const { session } = await requireBusiness();
  await assertRole(session.user.id, listing.businessId, [...OWNER_MANAGER]);
  await requireEntitlement(listing.businessId, "loyalty");
  return listing;
}

function isRateLimited(phone: string): boolean {
  const now = Date.now();
  const recent = (attemptsByPhone.get(phone) ?? []).filter(
    (at) => now - at < 60 * 60 * 1000,
  );
  attemptsByPhone.set(phone, recent);
  return recent.length >= 5;
}

function recordAttempt(phone: string): void {
  attemptsByPhone.set(phone, [...(attemptsByPhone.get(phone) ?? []), Date.now()]);
}
