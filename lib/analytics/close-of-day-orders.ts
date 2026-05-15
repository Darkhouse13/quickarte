import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders } from "@/lib/db/schema";
import type { BusinessDayBounds } from "@/lib/business/business-day";
import { formatShortOrderId } from "@/lib/ordering/customer-view";
import { summarizeOrderItemOptions } from "@/lib/ordering/order-item-options";
import type { OrderLifecycleStatus } from "@/lib/ordering/status";
import type { PosStatus } from "@/lib/ordering/pos-reconciliation";

export type OrderStatus = OrderLifecycleStatus;

export type OrderListItemFilters = {
  statusIn?: OrderStatus[];
  posStatus?: Exclude<PosStatus, "not_required">;
  tableNumberQuery?: string;
};

export type OrderListItem = {
  id: string;
  shortRef: string;
  createdAt: Date;
  type: "dine_in" | "takeaway" | "delivery";
  tableNumber: string | null;
  status: OrderStatus;
  posStatus: PosStatus;
  posReference: string | null;
  totalMad: number;
  itemsSummary: string;
  customerPhone: string | null;
  customerNote: string | null;
};

export type OrderListSort = "asc" | "desc";

export type OrderListRow = {
  id: string;
  createdAt: Date;
  type: "dine_in" | "takeaway" | "delivery";
  tableNumber: string | null;
  status: OrderStatus;
  posStatus: PosStatus;
  posReference: string | null;
  total: string | number;
  paymentMode?: "mad" | "credits";
  creditsUsed?: number | null;
  customerPhone: string | null;
  notes: string | null;
  items: OrderListItemRow[];
};

export type OrderListItemRow = {
  quantity: number;
  creditUnitPrice?: number | null;
  optionsJson: unknown;
  product: { name: string } | null;
};

export type OrderRowsSource = (
  businessId: string,
  bounds: BusinessDayBounds,
) => Promise<OrderListRow[]>;

export type OrdersForDayOptions = {
  source?: OrderRowsSource;
  sort?: OrderListSort;
};

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] satisfies OrderStatus[];

const POS_STATUSES = ["pending", "entered", "skipped"] satisfies Array<
  Exclude<PosStatus, "not_required">
>;

export async function getOrdersForDay(
  businessId: string,
  bounds: BusinessDayBounds,
  filters: OrderListItemFilters = {},
  options: OrdersForDayOptions = {},
): Promise<OrderListItem[]> {
  const rows = await (options.source ?? queryOrderRowsForDay)(businessId, bounds);
  return sortOrderRows(applyOrderListFilters(rows, filters), options.sort ?? "desc").map(
    orderListItemFromRow,
  );
}

export function applyOrderListFilters(
  rows: OrderListRow[],
  filters: OrderListItemFilters = {},
): OrderListRow[] {
  const statuses = expandStatusFilters(filters.statusIn);
  const posStatus = filters.posStatus;
  const tableQuery = filters.tableNumberQuery?.trim().toLocaleLowerCase("fr-MA");

  return rows.filter((row) => {
    if (statuses && !statuses.has(row.status)) return false;
    if (posStatus && row.posStatus !== posStatus) return false;
    if (
      tableQuery &&
      !(row.tableNumber ?? "").toLocaleLowerCase("fr-MA").includes(tableQuery)
    ) {
      return false;
    }
    return true;
  });
}

export function parsePosStatusFilter(
  raw: string | string[] | null | undefined,
): Exclude<PosStatus, "not_required"> | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const normalized = value?.trim();
  return POS_STATUSES.includes(normalized as Exclude<PosStatus, "not_required">)
    ? (normalized as Exclude<PosStatus, "not_required">)
    : undefined;
}

export function parseOrderStatusFilters(
  raw: string | string[] | null | undefined,
): OrderStatus[] | undefined {
  const values = (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const statuses = values.filter(isOrderStatus);
  return statuses.length > 0 ? Array.from(new Set(statuses)) : undefined;
}

export function orderListItemFromRow(row: OrderListRow): OrderListItem {
  return {
    id: row.id,
    shortRef: formatShortOrderId(row.id),
    createdAt: row.createdAt,
    type: row.type,
    tableNumber: row.tableNumber,
    status: row.status,
    posStatus: row.posStatus,
    posReference: row.posReference,
    totalMad: toNumber(row.total),
    itemsSummary: row.items.map(summarizeCloseOrderItem).join(" ; "),
    customerPhone: row.customerPhone,
    customerNote: row.notes,
  };
}

export function summarizeCloseOrderItem(item: OrderListItemRow): string {
  const creditSuffix =
    item.creditUnitPrice === null || item.creditUnitPrice === undefined
      ? ""
      : ` (${item.creditUnitPrice * item.quantity} credits)`;
  const base = `${item.quantity}x ${item.product?.name ?? "Article supprimé"}${creditSuffix}`;
  const optionLines = summarizeOrderItemOptions(item.optionsJson)
    .map((line) => line.trim())
    .filter(Boolean);
  return [base, ...optionLines].join(" - ");
}

export function summarizePosCountsFr(orders: Pick<OrderListItem, "posStatus">[]): string {
  const entered = orders.filter((order) => order.posStatus === "entered").length;
  const pending = orders.filter((order) => order.posStatus === "pending").length;
  const skipped = orders.filter((order) => order.posStatus === "skipped").length;
  return `Caisse : ${entered} ${entered === 1 ? "entrée" : "entrées"} · ${pending} en attente · ${skipped} ${skipped === 1 ? "sautée" : "sautées"}`;
}

async function queryOrderRowsForDay(
  businessId: string,
  bounds: BusinessDayBounds,
): Promise<OrderListRow[]> {
  const rows = await db.query.orders.findMany({
    where: and(
      eq(orders.businessId, businessId),
      gte(orders.createdAt, bounds.startUtc),
      lt(orders.createdAt, bounds.endUtc),
    ),
    orderBy: [desc(orders.createdAt)],
    columns: {
      id: true,
      createdAt: true,
      type: true,
      tableNumber: true,
      status: true,
      posStatus: true,
      posReference: true,
      total: true,
      paymentMode: true,
      creditsUsed: true,
      customerPhone: true,
      notes: true,
    },
    with: {
      items: {
        columns: {
          quantity: true,
          creditUnitPrice: true,
          optionsJson: true,
        },
        orderBy: [asc(orderItems.createdAt)],
        with: {
          product: {
            columns: { name: true },
          },
        },
      },
    },
  });

  return rows as OrderListRow[];
}

function sortOrderRows(rows: OrderListRow[], sort: OrderListSort): OrderListRow[] {
  const direction = sort === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const createdDelta = a.createdAt.getTime() - b.createdAt.getTime();
    if (createdDelta !== 0) return createdDelta * direction;
    return a.id.localeCompare(b.id) * direction;
  });
}

function expandStatusFilters(
  statusIn: OrderStatus[] | undefined,
): Set<OrderStatus> | null {
  if (!statusIn || statusIn.length === 0) return null;
  const statuses = new Set<OrderStatus>();
  for (const status of statusIn) {
    statuses.add(status);
    if (status === "pending") statuses.add("confirmed");
  }
  return statuses;
}

function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
