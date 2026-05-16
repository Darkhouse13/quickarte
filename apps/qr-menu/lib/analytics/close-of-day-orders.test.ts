import test from "node:test";
import assert from "node:assert/strict";
import { getBusinessDayBoundsForDateString } from "@/lib/business/business-day";
import {
  getOrdersForDay,
  parseOrderStatusFilters,
  summarizePosCountsFr,
  summarizeCloseOrderItem,
  type OrderListRow,
} from "./close-of-day-orders";

const businessId = "11111111-1111-4111-8111-111111111111";

const rows: OrderListRow[] = [
  row("aaaaaa00-0000-4000-8000-000000000001", "2026-05-14T08:00:00.000Z", "completed", "12"),
  row("bbbbbb00-0000-4000-8000-000000000002", "2026-05-14T09:00:00.000Z", "preparing", "21"),
  row("cccccc00-0000-4000-8000-000000000003", "2026-05-14T10:00:00.000Z", "ready", "112"),
  row("dddddd00-0000-4000-8000-000000000004", "2026-05-14T11:00:00.000Z", "cancelled", "3"),
  row("eeeeee00-0000-4000-8000-000000000005", "2026-05-14T12:00:00.000Z", "confirmed", "9"),
];

test("getOrdersForDay returns latest first by default", async () => {
  const orders = await list();

  assert.deepEqual(
    orders.map((order) => order.shortRef),
    ["EEEEEE", "DDDDDD", "CCCCCC", "BBBBBB", "AAAAAA"],
  );
});

test("getOrdersForDay filters by statusIn", async () => {
  const orders = await list({ statusIn: ["ready", "completed"] });

  assert.deepEqual(
    orders.map((order) => order.status),
    ["ready", "completed"],
  );
});

test("getOrdersForDay treats pending filter as the customer-facing Reçue bucket", async () => {
  const orders = await list({ statusIn: ["pending"] });

  assert.deepEqual(
    orders.map((order) => order.status),
    ["confirmed"],
  );
});

test("getOrdersForDay filters by table number substring", async () => {
  const orders = await list({ tableNumberQuery: "12" });

  assert.deepEqual(
    orders.map((order) => order.tableNumber),
    ["112", "12"],
  );
});

test("getOrdersForDay combines status and table filters", async () => {
  const orders = await list({
    statusIn: ["completed", "ready"],
    tableNumberQuery: "12",
  });

  assert.deepEqual(
    orders.map((order) => order.shortRef),
    ["CCCCCC", "AAAAAA"],
  );
});

test("getOrdersForDay filters by posStatus", async () => {
  const withPos = rows.map((item, index) => ({
    ...item,
    posStatus: index === 0 ? "entered" as const : "pending" as const,
  }));
  const orders = await list({ posStatus: "pending" }, withPos);

  assert.deepEqual(
    orders.map((order) => order.posStatus),
    ["pending", "pending", "pending", "pending"],
  );
});

test("summarizeCloseOrderItem uses the shared option summary lines", () => {
  assert.equal(
    summarizeCloseOrderItem(rows[0]!.items[0]!),
    "1x Tacos Atlas - Variante : L - Viande : Kefta, Mixte",
  );
});

test("parseOrderStatusFilters accepts comma-separated or repeated values", () => {
  assert.deepEqual(parseOrderStatusFilters(["ready,completed", "cancelled"]), [
    "ready",
    "completed",
    "cancelled",
  ]);
});

test("summarizePosCountsFr renders a typical 7-order caisse line", () => {
  const day = [
    "entered",
    "entered",
    "entered",
    "entered",
    "entered",
    "pending",
    "skipped",
  ].map((posStatus) => ({ posStatus: posStatus as OrderListRow["posStatus"] }));

  assert.equal(
    summarizePosCountsFr(day),
    "Caisse : 5 entrées · 1 en attente · 1 sautée",
  );
});

async function list(filters = {}, sourceRows = rows) {
  const bounds = getBusinessDayBoundsForDateString("2026-05-14");
  assert.ok(bounds);
  return getOrdersForDay(businessId, bounds, filters, {
    source: async () => sourceRows,
  });
}

function row(
  id: string,
  createdAt: string,
  status: OrderListRow["status"],
  tableNumber: string,
): OrderListRow {
  return {
    id,
    createdAt: new Date(createdAt),
    type: "dine_in",
    tableNumber,
    status,
    posStatus: "not_required",
    posReference: null,
    total: "55.00",
    customerPhone: "0611223344",
    notes: null,
    items: [
      {
        quantity: 1,
        product: { name: "Tacos Atlas" },
        optionsJson: {
          variantId: "variant-l",
          variantName: "L",
          variantPriceOverride: 55,
          selections: [
            {
              optionId: "meat",
              optionName: "Viande",
              optionType: "multi_select",
              values: [
                { valueId: "kefta", valueName: "Kefta", priceAddition: 0 },
                { valueId: "mixte", valueName: "Mixte", priceAddition: 0 },
              ],
            },
          ],
        },
      },
    ],
  };
}
