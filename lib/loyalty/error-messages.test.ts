import assert from "node:assert/strict";
import test from "node:test";
import {
  LOYALTY_ERROR_MESSAGES,
  loyaltyErrorMessage,
} from "./error-messages";

test("maps VALIDATION_ERROR to a French string", () => {
  assert.equal(loyaltyErrorMessage("VALIDATION_ERROR"), "Paramètres invalides.");
});

test("maps GOOGLE_PLACES_PREREQUISITES_MISSING to a French string", () => {
  assert.equal(
    loyaltyErrorMessage("GOOGLE_PLACES_PREREQUISITES_MISSING"),
    "Configurez d'abord votre identifiant Google Place.",
  );
});

test("maps NOT_FOUND to a French string", () => {
  assert.equal(loyaltyErrorMessage("NOT_FOUND"), "Élément introuvable.");
});

test("maps RATE_LIMITED to a French string", () => {
  assert.match(loyaltyErrorMessage("RATE_LIMITED"), /Réessayez/);
});

test("maps REVIEW_NOT_FOUND to a French string", () => {
  assert.match(loyaltyErrorMessage("REVIEW_NOT_FOUND"), /pas encore trouvé/);
});

test("maps REVIEW_ALREADY_CLAIMED to a French string", () => {
  assert.equal(
    loyaltyErrorMessage("REVIEW_ALREADY_CLAIMED"),
    "Cet avis a déjà été crédité.",
  );
});

test("maps REVIEW_REWARD_DISABLED to a French string", () => {
  assert.equal(
    loyaltyErrorMessage("REVIEW_REWARD_DISABLED"),
    "Cette récompense n'est pas activée.",
  );
});

test("maps LOYALTY_DISABLED to a French string", () => {
  assert.equal(loyaltyErrorMessage("LOYALTY_DISABLED"), "Le programme n'est pas actif.");
});

test("maps REDEMPTION_DISABLED to a French string", () => {
  assert.equal(
    loyaltyErrorMessage("REDEMPTION_DISABLED"),
    "Les récompenses ne sont pas actives.",
  );
});

test("maps ORDER_TYPE_DISABLED to a French string", () => {
  assert.equal(
    loyaltyErrorMessage("ORDER_TYPE_DISABLED"),
    "Ce type de commande est désactivé.",
  );
});

test("maps PRODUCT_NOT_REDEEMABLE to a French string", () => {
  assert.equal(
    loyaltyErrorMessage("PRODUCT_NOT_REDEEMABLE"),
    "Cet article n'est pas disponible en récompense.",
  );
});

test("maps INSUFFICIENT_CREDITS to a French string", () => {
  assert.equal(
    loyaltyErrorMessage("INSUFFICIENT_CREDITS"),
    "Solde de crédits insuffisant.",
  );
});

test("prefers server-supplied message over the static map", () => {
  assert.equal(
    loyaltyErrorMessage(
      "GOOGLE_PLACES_PREREQUISITES_MISSING",
      "Impossible d'activer la verification Google : il manque la cle API.",
    ),
    "Impossible d'activer la verification Google : il manque la cle API.",
  );
});

test("falls back when the code is unknown", () => {
  assert.equal(loyaltyErrorMessage("WAT"), "Une erreur est survenue.");
});

test("every known error code has a non-empty message", () => {
  for (const [code, message] of Object.entries(LOYALTY_ERROR_MESSAGES)) {
    assert.ok(message.length > 0, `${code} should have a message`);
  }
});

test("maps LOYALTY_NOT_ENTITLED to a French string", () => {
  assert.equal(
    loyaltyErrorMessage("LOYALTY_NOT_ENTITLED"),
    "Le programme de fidélité n'est pas actif.",
  );
});

test("maps NETWORK_ERROR to a French string", () => {
  assert.equal(
    loyaltyErrorMessage("NETWORK_ERROR"),
    "Une erreur est survenue. Réessayez.",
  );
});

test("covers each error code surfaced by the customer redemption flow", () => {
  // The customer-side review/redemption flow should be able to render a
  // human-readable message for every typed code the server can throw.
  const required = [
    "REVIEW_REWARD_DISABLED",
    "REVIEW_NOT_FOUND",
    "REVIEW_ALREADY_CLAIMED",
    "RATE_LIMITED",
    "INSUFFICIENT_CREDITS",
    "PRODUCT_NOT_REDEEMABLE",
    "LOYALTY_NOT_ENTITLED",
    "REDEMPTION_DISABLED",
    "NETWORK_ERROR",
  ];
  for (const code of required) {
    assert.match(loyaltyErrorMessage(code), /\S/);
    assert.notEqual(
      loyaltyErrorMessage(code),
      "Une erreur est survenue.",
      `${code} should not fall through to the generic message`,
    );
  }
});
