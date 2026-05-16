import {
  DEFAULT_BUSINESS_TIMEZONE,
  formatBusinessTime,
} from "@/lib/business/business-day";
import type { OrderListItem, OrderStatus } from "./close-of-day-orders";

export const CLOSE_CSV_HEADER = [
  "Heure",
  "Référence",
  "Type",
  "Table",
  "Articles",
  "Total (MAD)",
  "Statut",
  "Caisse",
  "Téléphone",
  "Note client",
] as const;

export type CloseCsvTotals = {
  revenueMad: number;
  orderCount: number;
};

export type BuildCloseCsvInput = {
  orders: OrderListItem[];
  totals: CloseCsvTotals;
  timezone?: string;
};

export function buildCloseCsv({
  orders,
  totals,
  timezone = DEFAULT_BUSINESS_TIMEZONE,
}: BuildCloseCsvInput): string {
  return `\uFEFF${Array.from(closeCsvLines({ orders, totals, timezone })).join(
    "\r\n",
  )}\r\n`;
}

export function streamCloseCsv(input: BuildCloseCsvInput): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = closeCsvLines(input);
  let sentBom = false;

  return new ReadableStream({
    pull(controller) {
      if (!sentBom) {
        controller.enqueue(encoder.encode("\uFEFF"));
        sentBom = true;
      }

      const next = lines.next();
      if (next.done) {
        controller.close();
        return;
      }

      controller.enqueue(encoder.encode(`${next.value}\r\n`));
    },
  });
}

export function* closeCsvLines({
  orders,
  totals,
  timezone = DEFAULT_BUSINESS_TIMEZONE,
}: BuildCloseCsvInput): Generator<string> {
  yield csvLine(CLOSE_CSV_HEADER);
  for (const order of orders) {
    yield closeOrderCsvLine(order, timezone);
  }
  yield "";
  yield csvLine([
    "Total",
    "",
    "",
    "",
    "",
    formatMadCsv(totals.revenueMad),
    `${totals.orderCount} commande(s)`,
    "",
    "",
    "",
  ]);
}

export function closeOrderCsvLine(
  order: OrderListItem,
  timezone = DEFAULT_BUSINESS_TIMEZONE,
): string {
  return csvLine([
    formatBusinessTime(order.createdAt, timezone),
    order.shortRef,
    formatOrderTypeFr(order.type),
    order.tableNumber ?? "",
    order.itemsSummary,
    formatMadCsv(order.totalMad),
    formatOrderStatusFr(order.status),
    formatPosStatusFr(order.posStatus, order.posReference),
    order.customerPhone ?? "",
    order.customerNote ?? "",
  ]);
}

export function csvLine(values: readonly string[]): string {
  return values.map(escapeCsvCell).join(";");
}

export function escapeCsvCell(value: string): string {
  if (!/[;"\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function formatMadCsv(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function formatMadDisplay(value: number): string {
  return `${value.toFixed(2)} MAD`;
}

export function formatOrderTypeFr(type: OrderListItem["type"]): string {
  switch (type) {
    case "dine_in":
      return "Sur place";
    case "takeaway":
      return "À emporter";
    case "delivery":
      return "Livraison";
  }
}

export function formatOrderStatusFr(status: OrderStatus): string {
  switch (status) {
    case "pending":
    case "confirmed":
      return "Reçue";
    case "preparing":
      return "En préparation";
    case "ready":
      return "Prête";
    case "completed":
      return "Servie";
    case "cancelled":
      return "Annulée";
  }
}

export function formatPosStatusFr(
  status: OrderListItem["posStatus"],
  posReference?: string | null,
): string {
  const suffix = posReference?.trim() ? ` (${posReference.trim()})` : "";
  switch (status) {
    case "not_required":
      return "";
    case "pending":
      return "À entrer";
    case "entered":
      return `Entrée${suffix}`;
    case "skipped":
      return `Sautée${suffix}`;
  }
}
