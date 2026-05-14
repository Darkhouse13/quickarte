import test from "node:test";
import assert from "node:assert/strict";
import { buildPrintJobsForEnabledPrinters } from "./job-builder";
import type { TicketOrder } from "./ticket";

type PrinterConnectionType = "manual" | "webprint" | "escpos_lan" | "escpos_usb";
type PrinterStation = "counter" | "kitchen" | "bar";

const order: TicketOrder = {
  id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  customerName: "Yasmine",
  customerPhone: null,
  type: "dine_in",
  tableNumber: "12",
  notes: null,
  total: "120.00",
  createdAt: new Date("2026-05-14T12:00:00"),
  items: [
    line("Tacos poulet", "50.00"),
    line("Frites", "20.00"),
    line("Cafe noir", "15.00"),
    line("The menthe", "35.00"),
  ],
};

test("buildPrintJobsForEnabledPrinters creates kitchen/bar station-filtered jobs", () => {
  const jobs = buildPrintJobsForEnabledPrinters(
    order,
    [
      printer("kitchen-printer", "kitchen"),
      printer("bar-printer", "bar"),
    ],
    new Map([
      ["kitchen", [order.items[0]!, order.items[1]!]],
      ["bar", [order.items[2]!, order.items[3]!]],
    ]),
  );

  assert.equal(jobs.length, 2);
  assert.match(jobs[0]!.payloadText, /Tacos poulet/);
  assert.match(jobs[0]!.payloadText, /Frites/);
  assert.doesNotMatch(jobs[0]!.payloadText, /Cafe noir/);
  assert.doesNotMatch(jobs[0]!.payloadText, /TOTAL/);
  assert.match(jobs[1]!.payloadText, /Cafe noir/);
  assert.match(jobs[1]!.payloadText, /The menthe/);
  assert.doesNotMatch(jobs[1]!.payloadText, /Tacos poulet/);
  assert.doesNotMatch(jobs[1]!.payloadText, /TOTAL/);
});

test("buildPrintJobsForEnabledPrinters skips empty stations and counter prints full order", () => {
  const jobs = buildPrintJobsForEnabledPrinters(
    order,
    [
      printer("counter-printer", "counter"),
      printer("kitchen-printer", "kitchen"),
      printer("bar-printer", "bar"),
    ],
    new Map([
      ["counter", order.items],
      ["bar", [order.items[2]!, order.items[3]!]],
    ]),
  );

  assert.deepEqual(
    jobs.map((job) => job.printerId),
    ["counter-printer", "bar-printer"],
  );
  assert.match(jobs[0]!.payloadText, /Tacos poulet/);
  assert.match(jobs[0]!.payloadText, /Cafe noir/);
  assert.match(jobs[0]!.payloadText, /TOTAL\s+120\.00 MAD/);
  assert.doesNotMatch(jobs[1]!.payloadText, /TOTAL/);
});

function printer(id: string, station: PrinterStation) {
  return { id, station, connectionType: "webprint" as PrinterConnectionType };
}

function line(name: string, subtotal: string): TicketOrder["items"][number] {
  return {
    quantity: 1,
    unitPrice: subtotal,
    subtotal,
    optionsJson: null,
    product: { name },
  };
}
