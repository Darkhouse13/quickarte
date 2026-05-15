import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  creditTransactions,
  loyaltyMembers,
  loyaltyPrograms,
  orderEvents,
  orders,
} from "@/lib/db/schema";
import { summarizeOrderItemOptions } from "./order-item-options";

// hasEntitlement lives behind a `server-only` import that throws when loaded
// from a non-server context. The pure helpers in this file (used directly by
// unit tests) don't need it, so we defer the load to the call site to keep
// the test boot path clean.
async function hasLoyaltyEntitlement(businessId: string): Promise<boolean> {
  const { hasEntitlement } = await import("@/lib/entitlements/queries");
  return hasEntitlement(businessId, "loyalty");
}

const CUSTOMER_EVENT_TYPES = [
  "order.created",
  "order.accepted",
  "order.preparing",
  "order.ready",
  "order.served",
  "order.cancelled",
] as const;

type CustomerEventType = (typeof CUSTOMER_EVENT_TYPES)[number];

export type CustomerOrderResponse = {
  business: {
    name: string;
    slug: string;
    whatsappNumber: string | null;
    postOrderMessage: string | null;
  };
  order: {
    id: string;
    status: string;
    type: string;
    tableNumber: string | null;
    notes: string | null;
    createdAt: Date;
    // Raw MAD amount as a decimal number. The customer page owns formatting.
    total: number;
    // The phone we have on file for this order. We only echo it back when
    // loyalty surfaces on the tracker so the /avis and /recompenses deep
    // links can carry it without a roundtrip — the customer is reading
    // their own phone, no one else's.
    customerPhone: string | null;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      optionLines: string[];
    }>;
    timeline: Array<{ type: CustomerEventType; at: Date }>;
  };
  // null whenever the credit loop should not surface on the tracker — no
  // entitlement, no program, or anonymous order without a phone on file.
  loyalty: CustomerLoyaltyBlock | null;
};

export type CustomerLoyaltyBlock = {
  creditLabel: string;
  balance: number;
  // `null` when the merchant has not enabled the order-reward path; the
  // tracker copy distinguishes "earn by ordering" vs "earn nothing today".
  accrualPerMad: number;
  // null when review reward is off; the tracker hides the CTA in that case.
  reviewReward: {
    enabled: boolean;
    creditsPerReview: number;
    googlePlaceId: string;
  } | null;
  // Server-derived: false when this phone already has a google_review credit
  // for this business inside the program's review-window. The client never
  // sees the raw transaction history.
  canClaimReview: boolean;
};

export type CustomerOrderStatusResponse = {
  status: string;
  latestEventAt: Date;
  // null when loyalty is not surfaced on this order; otherwise the current
  // member balance so the tracker can detect jumps without a full re-fetch.
  balance: number | null;
};

export async function getCustomerOrderByToken(
  token: string,
): Promise<CustomerOrderResponse | null> {
  const row = await db.query.orders.findFirst({
    where: eq(orders.customerAccessToken, token),
    columns: {
      id: true,
      status: true,
      type: true,
      tableNumber: true,
      notes: true,
      createdAt: true,
      total: true,
      customerPhone: true,
    },
    with: {
      business: {
        columns: { id: true, name: true, slug: true },
        with: {
          settings: {
            columns: {
              whatsappNumber: true,
              customerPostOrderMessage: true,
              googlePlaceId: true,
            },
          },
        },
      },
      items: {
        columns: {
          quantity: true,
          unitPrice: true,
          optionsJson: true,
        },
        with: {
          product: {
            columns: { name: true },
          },
        },
      },
      events: {
        columns: {
          eventType: true,
          createdAt: true,
        },
        where: inArray(orderEvents.eventType, [...CUSTOMER_EVENT_TYPES]),
        orderBy: [orderEvents.createdAt],
      },
    },
  });

  if (!row) return null;

  const loyalty = await buildCustomerLoyaltyBlock({
    businessId: row.business.id,
    customerPhoneNormalized: row.customerPhone,
    googlePlaceId: row.business.settings?.googlePlaceId ?? null,
  });

  return {
    business: {
      name: row.business.name,
      slug: row.business.slug,
      whatsappNumber: row.business.settings?.whatsappNumber ?? null,
      postOrderMessage:
        row.business.settings?.customerPostOrderMessage ?? null,
    },
    order: {
      id: row.id,
      status: row.status,
      type: row.type,
      tableNumber: row.type === "dine_in" ? row.tableNumber : null,
      notes: row.notes,
      createdAt: row.createdAt,
      total: Number(row.total),
      // Only echoed when the loyalty surfaces — we keep the order page
      // identical for non-loyalty contexts.
      customerPhone: loyalty ? row.customerPhone ?? null : null,
      items: row.items.map((item) => ({
        name: item.product?.name ?? "Article",
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        optionLines: customerOptionLinesFromJson(item.optionsJson),
      })),
      timeline: row.events.flatMap((event) =>
        isCustomerEventType(event.eventType)
          ? [{ type: event.eventType, at: event.createdAt }]
          : [],
      ),
    },
    loyalty,
  };
}

export async function getCustomerOrderStatusByToken(
  token: string,
): Promise<CustomerOrderStatusResponse | null> {
  const row = await db.query.orders.findFirst({
    where: eq(orders.customerAccessToken, token),
    columns: {
      id: true,
      status: true,
      createdAt: true,
      businessId: true,
      customerPhone: true,
    },
  });
  if (!row) return null;

  const latestEvent = await db.query.orderEvents.findFirst({
    where: and(
      eq(orderEvents.orderId, row.id),
      inArray(orderEvents.eventType, [...CUSTOMER_EVENT_TYPES]),
    ),
    columns: { createdAt: true },
    orderBy: [desc(orderEvents.createdAt)],
  });

  // Only join through loyalty when we already know there is a phone to look
  // up — anonymous orders cost nothing extra on the poll.
  const balance = row.customerPhone
    ? await readSurfacedBalance(row.businessId, row.customerPhone)
    : null;

  return {
    status: row.status,
    latestEventAt: latestEvent?.createdAt ?? row.createdAt,
    balance,
  };
}

async function readSurfacedBalance(
  businessId: string,
  customerPhoneNormalized: string,
): Promise<number | null> {
  if (!(await hasLoyaltyEntitlement(businessId))) return null;
  const program = await db.query.loyaltyPrograms.findFirst({
    where: eq(loyaltyPrograms.businessId, businessId),
    columns: { enabled: true, loyaltyType: true },
  });
  if (!program?.enabled || program.loyaltyType !== "credits") return null;
  const member = await db.query.loyaltyMembers.findFirst({
    where: and(
      eq(loyaltyMembers.businessId, businessId),
      eq(loyaltyMembers.customerPhoneNormalized, customerPhoneNormalized),
    ),
    columns: { balance: true },
  });
  return member?.balance ?? 0;
}

async function buildCustomerLoyaltyBlock(input: {
  businessId: string;
  customerPhoneNormalized: string | null;
  googlePlaceId: string | null;
}): Promise<CustomerLoyaltyBlock | null> {
  if (!input.customerPhoneNormalized) return null;
  if (!(await hasLoyaltyEntitlement(input.businessId))) return null;
  const program = await db.query.loyaltyPrograms.findFirst({
    where: eq(loyaltyPrograms.businessId, input.businessId),
  });
  if (!program?.enabled || program.loyaltyType !== "credits") return null;

  const member = await db.query.loyaltyMembers.findFirst({
    where: and(
      eq(loyaltyMembers.businessId, input.businessId),
      eq(loyaltyMembers.customerPhoneNormalized, input.customerPhoneNormalized),
    ),
    columns: { balance: true },
  });

  const reviewRewardActive =
    program.reviewRewardEnabled &&
    program.creditsPerReview > 0 &&
    !!input.googlePlaceId?.trim();

  const reviewReward = reviewRewardActive
    ? {
        enabled: true,
        creditsPerReview: program.creditsPerReview,
        googlePlaceId: input.googlePlaceId!.trim(),
      }
    : null;

  // canClaimReview reflects whether this phone is currently inside the
  // review-window with no existing google_review grant for this business.
  // We do not leak which review or when — the tracker only needs a boolean.
  let canClaimReview = false;
  if (reviewReward) {
    const cutoff = new Date(
      Date.now() - program.reviewMaxAgeDays * 24 * 60 * 60 * 1000,
    );
    const existing = await db.query.creditTransactions.findFirst({
      where: and(
        eq(creditTransactions.businessId, input.businessId),
        eq(
          creditTransactions.customerPhoneNormalized,
          input.customerPhoneNormalized,
        ),
        eq(creditTransactions.source, "google_review"),
        gte(creditTransactions.createdAt, cutoff),
      ),
      columns: { id: true },
    });
    canClaimReview = !existing;
  }

  return {
    creditLabel: program.creditLabel,
    balance: member?.balance ?? 0,
    accrualPerMad: Number(program.accrualPerMad),
    reviewReward,
    canClaimReview,
  };
}

export function customerOptionLinesFromJson(optionsJson: unknown): string[] {
  return summarizeOrderItemOptions(optionsJson);
}

export function isCustomerEventType(value: string): value is CustomerEventType {
  return CUSTOMER_EVENT_TYPES.includes(value as CustomerEventType);
}
