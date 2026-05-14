import test from "node:test";
import assert from "node:assert/strict";
import { assertTicketWidth, renderTicket, type TicketOrder } from "./ticket";

const tacosOrder: TicketOrder = {
  id: "11111111-2222-4333-8444-555555555555",
  customerName: "Yasmine",
  customerPhone: "0611223344",
  type: "dine_in",
  tableNumber: "7",
  notes: "Sans oignons, sauce a part",
  total: "76.00",
  createdAt: new Date("2026-05-14T12:34:00"),
  items: [
    {
      quantity: 1,
      unitPrice: "76.00",
      subtotal: "76.00",
      product: { name: "Tacos" },
      optionsJson: {
        variantId: "variant-2-meats",
        variantName: "2 viandes",
        variantPriceOverride: 76,
        selections: [
          {
            optionId: "meats",
            optionName: "Viandes",
            optionType: "multi_select",
            values: [
              { valueId: "chicken", valueName: "Poulet", priceAddition: 0 },
              {
                valueId: "kefta",
                valueName: "Viande hachee",
                priceAddition: 0,
              },
            ],
          },
          {
            optionId: "sauces",
            optionName: "Sauces",
            optionType: "multi_select",
            values: [
              { valueId: "algerienne", valueName: "Algerienne", priceAddition: 0 },
              { valueId: "andalouse", valueName: "Andalouse", priceAddition: 0 },
              { valueId: "samourai", valueName: "Samourai", priceAddition: 0 },
            ],
          },
          {
            optionId: "extras",
            optionName: "Extras",
            optionType: "multi_select",
            values: [
              { valueId: "cheese", valueName: "Fromage", priceAddition: 6 },
              { valueId: "fries", valueName: "Frites", priceAddition: 5 },
            ],
          },
        ],
      },
    },
  ],
};

test("renderTicket emits a stable 32-column manual ticket", () => {
  const ticket = renderTicket(tacosOrder);

  assertTicketWidth(ticket);
  assert.match(ticket, /TABLE 7/);
  assert.match(ticket, /76\.00 MAD/);
  assert.equal(ticket, `           QUICKARTE
================================
            TABLE 7
================================
Commande 11111111
Client Yasmine
Tel 0611223344
Heure 12:34
--------------------------------
1x Tacos               76.00 MAD
  Variante : 2 viandes
  Viandes : Poulet, Viande
  hachee
  Sauces : Algerienne,
  Andalouse, Samourai
  Extras : Fromage, Frites
--------------------------------
Note client
  Sans oignons, sauce a part
--------------------------------
TOTAL                  76.00 MAD

             Merci`);
});

test("renderTicket wraps long option lines with a two-space hanging indent", () => {
  const ticket = renderTicket({
    ...tacosOrder,
    items: [
      {
        ...tacosOrder.items[0]!,
        optionsJson: {
          variantId: null,
          variantName: null,
          variantPriceOverride: null,
          selections: [
            {
              optionId: "sauces",
              optionName: "Sauces",
              optionType: "multi_select",
              values: [
                { valueId: "a", valueName: "Algerienne", priceAddition: 0 },
                { valueId: "b", valueName: "Samourai", priceAddition: 0 },
                { valueId: "c", valueName: "Harissa", priceAddition: 0 },
                { valueId: "d", valueName: "Blanche", priceAddition: 0 },
                { valueId: "e", valueName: "BBQ", priceAddition: 0 },
              ],
            },
          ],
        },
      },
    ],
  });

  assertTicketWidth(ticket);
  assert.match(ticket, /  Sauces : Algerienne, Samourai/);
  assert.match(ticket, /  Harissa, Blanche, BBQ/);
});

test("renderTicket omits totals for kitchen/bar station tickets", () => {
  const ticket = renderTicket(tacosOrder, {
    stationFilter: "kitchen",
    omitTotal: true,
  });

  assertTicketWidth(ticket);
  assert.match(ticket, /TABLE 7/);
  assert.match(ticket, /Commande 11111111/);
  assert.doesNotMatch(ticket, /TOTAL/);
  assert.doesNotMatch(ticket, /76\.00 MAD/);
  assert.match(ticket, /Variante : 2 viandes/);
});

test("renderTicket keeps the total on counter tickets", () => {
  const ticket = renderTicket(tacosOrder, { stationFilter: "counter" });

  assertTicketWidth(ticket);
  assert.match(ticket, /TABLE 7/);
  assert.match(ticket, /TOTAL\s+76\.00 MAD/);
});

test("Snack Atlas station ticket shows only tacos when coffee routes to bar", () => {
  const mixedOrder: TicketOrder = {
    ...tacosOrder,
    total: "88.00",
    items: [
      tacosOrder.items[0]!,
      {
        quantity: 1,
        unitPrice: "12.00",
        subtotal: "12.00",
        product: { name: "Cafe noir" },
        optionsJson: null,
      },
    ],
  };
  const kitchenTicket = renderTicket(
    { ...mixedOrder, items: [mixedOrder.items[0]!] },
    { stationFilter: "kitchen", omitTotal: true },
  );

  assertTicketWidth(kitchenTicket);
  assert.match(kitchenTicket, /1x Tacos/);
  assert.doesNotMatch(kitchenTicket, /Cafe noir/);
  assert.doesNotMatch(kitchenTicket, /TOTAL/);
});
