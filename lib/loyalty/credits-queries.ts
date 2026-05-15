import "server-only";
import { and, desc, eq, ilike, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  businessSettings,
  creditTransactions,
  googleReviewGrants,
  loyaltyMembers,
  loyaltyPrograms,
  orders,
  products,
  redemptionListings,
  type CreditTransaction,
  type GoogleReviewGrant,
  type LoyaltyMember,
  type LoyaltyProgram,
  type RedemptionListing,
} from "@/lib/db/schema";
import { normalizeMoroccanPhone } from "@/lib/utils/phone";

export type CreditProgramSnapshot = {
  program: LoyaltyProgram | null;
  googlePlaceId: string | null;
  totalCustomers: number;
  totalCreditsOutstanding: number;
};

/**
 * One DB round-trip via parallel queries: settings + program + customer
 * counters. Used to render the page heading summary line.
 */
export async function getCreditProgramSnapshot(
  businessId: string,
): Promise<CreditProgramSnapshot> {
  const [programRow, settingsRow, totals] = await Promise.all([
    db.query.loyaltyPrograms.findFirst({
      where: eq(loyaltyPrograms.businessId, businessId),
    }),
    db.query.businessSettings.findFirst({
      where: eq(businessSettings.businessId, businessId),
      columns: { googlePlaceId: true },
    }),
    db
      .select({
        customers: sql<number>`count(*)::int`,
        balanceSum: sql<number>`coalesce(sum(${loyaltyMembers.balance}), 0)::int`,
      })
      .from(loyaltyMembers)
      .where(eq(loyaltyMembers.businessId, businessId)),
  ]);
  const totalsRow = totals[0];
  return {
    program: programRow ?? null,
    googlePlaceId: settingsRow?.googlePlaceId?.trim() || null,
    totalCustomers: totalsRow?.customers ?? 0,
    totalCreditsOutstanding: totalsRow?.balanceSum ?? 0,
  };
}

export type RedemptionListingWithProduct = RedemptionListing & {
  productName: string;
  productPriceMad: number;
  productAvailable: boolean;
};

export async function listRedemptionListings(
  businessId: string,
): Promise<RedemptionListingWithProduct[]> {
  const rows = await db
    .select({
      id: redemptionListings.id,
      businessId: redemptionListings.businessId,
      productId: redemptionListings.productId,
      creditPrice: redemptionListings.creditPrice,
      active: redemptionListings.active,
      position: redemptionListings.position,
      createdAt: redemptionListings.createdAt,
      updatedAt: redemptionListings.updatedAt,
      productName: products.name,
      productPriceMad: products.price,
      productAvailable: products.available,
    })
    .from(redemptionListings)
    .innerJoin(products, eq(products.id, redemptionListings.productId))
    .where(eq(redemptionListings.businessId, businessId))
    .orderBy(redemptionListings.position, redemptionListings.createdAt);
  return rows.map((r) => ({
    ...r,
    productPriceMad: Number(r.productPriceMad),
  }));
}

export type AddableProduct = {
  id: string;
  name: string;
  priceMad: number;
};

/**
 * Products that are not already wired to a redemption listing for this
 * business. Used by the product picker on the Récompenses tab.
 */
export async function listAddableRedemptionProducts(
  businessId: string,
): Promise<AddableProduct[]> {
  const existing = await db
    .select({ productId: redemptionListings.productId })
    .from(redemptionListings)
    .where(eq(redemptionListings.businessId, businessId));
  const excluded = existing.map((r) => r.productId);
  const where = excluded.length
    ? and(
        eq(products.businessId, businessId),
        sql`${products.id} NOT IN (${sql.join(
          excluded.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
    : eq(products.businessId, businessId);
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      priceMad: products.price,
    })
    .from(products)
    .where(where)
    .orderBy(products.name);
  return rows.map((r) => ({ ...r, priceMad: Number(r.priceMad) }));
}

export type CustomerListItem = {
  id: string;
  customerPhoneNormalized: string;
  balance: number;
  lastActivityAt: Date;
};

export async function listCreditCustomers(
  businessId: string,
  opts: { search?: string; limit?: number; offset?: number } = {},
): Promise<{ rows: CustomerListItem[]; hasMore: boolean }> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const search = opts.search?.trim();
  const where = search
    ? and(
        eq(loyaltyMembers.businessId, businessId),
        ilike(loyaltyMembers.customerPhoneNormalized, `%${search}%`),
      )
    : eq(loyaltyMembers.businessId, businessId);
  const rows = await db
    .select({
      id: loyaltyMembers.id,
      customerPhoneNormalized: loyaltyMembers.customerPhoneNormalized,
      balance: loyaltyMembers.balance,
      lastActivityAt: loyaltyMembers.lastActivityAt,
    })
    .from(loyaltyMembers)
    .where(where)
    .orderBy(desc(loyaltyMembers.lastActivityAt))
    .limit(limit + 1)
    .offset(offset);
  const hasMore = rows.length > limit;
  return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

export type CustomerSummary = {
  member: LoyaltyMember | null;
  firstKnownName: string | null;
};

export async function getCustomerSummary(
  businessId: string,
  phoneNormalized: string,
): Promise<CustomerSummary> {
  const phone = normalizeMoroccanPhone(phoneNormalized);
  const [member, namedOrder] = await Promise.all([
    db.query.loyaltyMembers.findFirst({
      where: and(
        eq(loyaltyMembers.businessId, businessId),
        eq(loyaltyMembers.customerPhoneNormalized, phone),
      ),
    }),
    db.query.orders.findFirst({
      where: and(
        eq(orders.businessId, businessId),
        eq(orders.customerPhone, phone),
        isNotNull(orders.customerName),
      ),
      orderBy: orders.createdAt,
      columns: { customerName: true },
    }),
  ]);
  return {
    member: member ?? null,
    firstKnownName:
      namedOrder?.customerName && namedOrder.customerName !== phone
        ? namedOrder.customerName
        : null,
  };
}

export async function listCustomerLedger(
  businessId: string,
  phoneNormalized: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ rows: CreditTransaction[]; hasMore: boolean }> {
  const phone = normalizeMoroccanPhone(phoneNormalized);
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const rows = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.businessId, businessId),
        eq(creditTransactions.customerPhoneNormalized, phone),
      ),
    )
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit + 1)
    .offset(offset);
  const hasMore = rows.length > limit;
  return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

export type CustomerRedemptionListing = {
  listingId: string;
  productId: string;
  productName: string;
  productDescription: string | null;
  productImage: string | null;
  creditPrice: number;
  position: number;
};

/**
 * Customer-facing view: active listings whose underlying product is still
 * available. Ordered by position then createdAt — matches the merchant
 * configuration order shown in the loyalty admin. The customer page filters
 * out inactive listings server-side so the menu never momentarily flashes a
 * disabled card.
 */
export async function listActiveRedemptionListingsForCustomer(
  businessId: string,
): Promise<CustomerRedemptionListing[]> {
  const rows = await db
    .select({
      listingId: redemptionListings.id,
      productId: redemptionListings.productId,
      productName: products.name,
      productDescription: products.description,
      productImage: products.image,
      creditPrice: redemptionListings.creditPrice,
      position: redemptionListings.position,
    })
    .from(redemptionListings)
    .innerJoin(products, eq(products.id, redemptionListings.productId))
    .where(
      and(
        eq(redemptionListings.businessId, businessId),
        eq(redemptionListings.active, true),
        eq(products.available, true),
      ),
    )
    .orderBy(redemptionListings.position, redemptionListings.createdAt);
  return rows.map((r) => ({
    listingId: r.listingId,
    productId: r.productId,
    productName: r.productName,
    productDescription: r.productDescription ?? null,
    productImage: r.productImage ?? null,
    creditPrice: r.creditPrice,
    position: r.position,
  }));
}

export async function listGoogleReviewGrants(
  businessId: string,
  opts: { limit?: number } = {},
): Promise<GoogleReviewGrant[]> {
  return await db
    .select()
    .from(googleReviewGrants)
    .where(eq(googleReviewGrants.businessId, businessId))
    .orderBy(desc(googleReviewGrants.createdAt))
    .limit(opts.limit ?? 20);
}
