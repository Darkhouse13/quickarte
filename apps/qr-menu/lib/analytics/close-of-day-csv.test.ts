import test from "node:test";
import assert from "node:assert/strict";
import { summarizeOrderItemOptions } from "@/lib/ordering/order-item-options";
import { buildCloseCsv, streamCloseCsv } from "./close-of-day-csv";
import type { OrderListItem } from "./close-of-day-orders";

const tacosOptions = {
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
    {
      optionId: "sauces",
      optionName: "Sauces",
      optionType: "multi_select",
      values: [
        { valueId: "algerienne", valueName: "Algérienne", priceAddition: 0 },
        { valueId: "samourai", valueName: "Samouraï", priceAddition: 0 },
      ],
    },
  ],
};

const tacosArticles = [
  "1x Tacos Atlas",
  ...summarizeOrderItemOptions(tacosOptions).map((line) => line.trim()),
  'Note "chef"',
].join(" - ");

const orders: OrderListItem[] = [
  {
    id: "abcd1234-1111-4111-8111-111111111111",
    shortRef: "ABCD12",
    createdAt: new Date("2026-05-14T08:30:00.000Z"),
    type: "dine_in",
    tableNumber: "12",
    status: "completed",
    posStatus: "entered",
    posReference: "BC-1408",
    totalMad: 55.5,
    itemsSummary: `${tacosArticles} ; 1x Frites`,
    customerPhone: "0611223344",
    customerNote: "Sans oignons",
  },
  {
    id: "beef5678-1111-4111-8111-111111111111",
    shortRef: "BEEF56",
    createdAt: new Date("2026-05-14T09:15:00.000Z"),
    type: "takeaway",
    tableNumber: null,
    status: "cancelled",
    posStatus: "not_required",
    posReference: null,
    totalMad: 99,
    itemsSummary: "1x Burger",
    customerPhone: null,
    customerNote: "Client a annulé",
  },
];

test("buildCloseCsv emits UTF-8 BOM, semicolons, CRLF, and accented headers", () => {
  const csv = buildCloseCsv({
    orders,
    totals: { revenueMad: 55.5, orderCount: 1 },
  });
  const bytes = Buffer.from(csv, "utf8");

  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.ok(csv.startsWith("\uFEFFHeure;Référence;Type;Table;Articles"));
  assert.ok(csv.includes("Statut;Caisse;Téléphone;Note client"));
  assert.ok(csv.includes("\r\n"));
  assert.equal(csv.replace(/\r\n/g, "").includes("\n"), false);
  assert.ok(Buffer.from(csv, "utf8").toString("utf8").includes("Référence"));
});

test("buildCloseCsv keeps Snack Atlas articles aligned with summarizeOrderItemOptions", () => {
  const csv = buildCloseCsv({
    orders,
    totals: { revenueMad: 55.5, orderCount: 1 },
  });
  const firstOrderLine = csv.split("\r\n")[1];
  assert.ok(firstOrderLine);
  const cells = parseCsvLine(firstOrderLine);

  assert.equal(cells[0], "09:30");
  assert.equal(cells[1], "ABCD12");
  assert.equal(cells[2], "Sur place");
  assert.equal(cells[4], `${tacosArticles} ; 1x Frites`);
  assert.equal(cells[5], "55,50");
  assert.equal(cells[6], "Servie");
  assert.equal(cells[7], "Entrée (BC-1408)");
  assert.match(firstOrderLine, /"1x Tacos Atlas/);
  assert.match(firstOrderLine, /""chef""/);
});

test("buildCloseCsv includes cancelled rows but excludes them from the totals line", () => {
  const csv = buildCloseCsv({
    orders,
    totals: { revenueMad: 55.5, orderCount: 1 },
  });
  const lines = csv.slice(1).split("\r\n");
  const blankIndex = lines.indexOf("");
  const bodyRows = lines.slice(1, blankIndex);
  const totalsLine = lines[blankIndex + 1];

  assert.equal(bodyRows.length, 2);
  assert.ok(bodyRows.some((line) => line.includes("Annulée")));
  assert.equal(totalsLine, "Total;;;;;55,50;1 commande(s);;;");
});

test("streamCloseCsv emits the same BOM and row shape for large exports", async () => {
  const largeOrders = Array.from({ length: 501 }, (_, index) => ({
    ...orders[0]!,
    id: `abcd${index.toString().padStart(4, "0")}-1111-4111-8111-111111111111`,
    shortRef: `A${index.toString().padStart(5, "0")}`,
  }));
  const response = new Response(
    streamCloseCsv({
      orders: largeOrders,
      totals: { revenueMad: 55.5 * largeOrders.length, orderCount: largeOrders.length },
    }),
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  const csv = new TextDecoder().decode(bytes);
  const lines = csv.slice(1).split("\r\n");
  const blankIndex = lines.indexOf("");

  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(lines.slice(1, blankIndex).length, 501);
});

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ";" && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}
