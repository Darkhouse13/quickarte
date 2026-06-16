import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders } from "@/lib/db/schema";
import { summarizeOrderItemOptions } from "./order-item-options";

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
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      optionLines: string[];
    }>;
    timeline: Array<{ type: CustomerEventType; at: Date }>;
  };
};

export type CustomerOrderStatusResponse = {
  status: string;
  latestEventAt: Date;
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
    },
    with: {
      business: {
        columns: { id: true, name: true, slug: true },
        with: {
          settings: {
            columns: {
              whatsappNumber: true,
              customerPostOrderMessage: true,
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

  return {
    status: row.status,
    latestEventAt: latestEvent?.createdAt ?? row.createdAt,
  };
}

export function customerOptionLinesFromJson(optionsJson: unknown): string[] {
  return summarizeOrderItemOptions(optionsJson);
}

export function isCustomerEventType(value: string): value is CustomerEventType {
  return CUSTOMER_EVENT_TYPES.includes(value as CustomerEventType);
}
