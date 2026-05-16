import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWhatsappLink,
  customerStatusContext,
  customerStatusLabel,
  formatShortOrderId,
  isCustomerTerminalStatus,
} from "./customer-view";

test("status labels map every lifecycle status to a French word", () => {
  assert.equal(customerStatusLabel("pending"), "Reçue");
  assert.equal(customerStatusLabel("confirmed"), "Reçue");
  assert.equal(customerStatusLabel("preparing"), "En préparation");
  assert.equal(customerStatusLabel("ready"), "Prête");
  assert.equal(customerStatusLabel("completed"), "Servie");
  assert.equal(customerStatusLabel("cancelled"), "Annulée");
});

test("status context is type-independent for non-ready statuses", () => {
  assert.equal(
    customerStatusContext("pending", "dine_in"),
    "Votre commande est bien arrivée.",
  );
  assert.equal(
    customerStatusContext("confirmed", "takeaway"),
    "Votre commande est bien arrivée.",
  );
  assert.equal(
    customerStatusContext("preparing", "dine_in"),
    "Le restaurant prépare votre commande.",
  );
  assert.equal(customerStatusContext("completed", "dine_in"), "Merci.");
  assert.equal(
    customerStatusContext("cancelled", "dine_in"),
    "Contactez le restaurant pour en savoir plus.",
  );
});

test("status context for ready branches on order type", () => {
  assert.equal(
    customerStatusContext("ready", "dine_in"),
    "Sera apportée à votre table.",
  );
  assert.equal(
    customerStatusContext("ready", "takeaway"),
    "Prête à emporter.",
  );
  assert.equal(
    customerStatusContext("ready", "click_and_collect"),
    "À retirer au comptoir.",
  );
});

test("short order id takes the first six chars uppercased", () => {
  assert.equal(
    formatShortOrderId("abcd1234-5678-90ab-cdef-1234567890ab"),
    "ABCD12",
  );
  assert.equal(formatShortOrderId("0f9e8d7c"), "0F9E8D");
});

test("terminal status detection covers served and cancelled only", () => {
  assert.equal(isCustomerTerminalStatus("completed"), true);
  assert.equal(isCustomerTerminalStatus("cancelled"), true);
  assert.equal(isCustomerTerminalStatus("ready"), false);
  assert.equal(isCustomerTerminalStatus("preparing"), false);
  assert.equal(isCustomerTerminalStatus("pending"), false);
});

test("whatsapp link normalizes to E.164 and prefills the short order ref", () => {
  const link = buildWhatsappLink("0612345678", "ABCD12");
  assert.ok(link);
  assert.equal(
    link.url,
    `https://wa.me/212612345678?text=${encodeURIComponent(
      "Bonjour, à propos de ma commande #ABCD12.",
    )}`,
  );
  assert.equal(link.display, "+212 6 12 34 56 78");
});

test("whatsapp link accepts an already-E.164 number", () => {
  const link = buildWhatsappLink("+212655443322", "ZZ0099");
  assert.ok(link);
  assert.match(link.url, /^https:\/\/wa\.me\/212655443322\?text=/);
  assert.ok(link.url.includes(encodeURIComponent("#ZZ0099")));
});

test("whatsapp link is null when the number is missing", () => {
  assert.equal(buildWhatsappLink(null, "ABCD12"), null);
  assert.equal(buildWhatsappLink(undefined, "ABCD12"), null);
  assert.equal(buildWhatsappLink("", "ABCD12"), null);
  assert.equal(buildWhatsappLink("   ", "ABCD12"), null);
});
