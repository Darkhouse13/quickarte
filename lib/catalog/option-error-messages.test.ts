import assert from "node:assert/strict";
import test from "node:test";
import {
  OPTION_ERROR_MESSAGES,
  optionErrorMessage,
} from "./option-error-messages";

test("maps PRODUCT_UNAVAILABLE to a French string", () => {
  assert.equal(
    optionErrorMessage("PRODUCT_UNAVAILABLE"),
    "Cet article n'est plus disponible.",
  );
});

test("maps VARIANT_INVALID to a French string", () => {
  assert.equal(
    optionErrorMessage("VARIANT_INVALID"),
    "Cette taille n'est pas valide.",
  );
});

test("maps OPTION_REQUIRED_MISSING to a French string", () => {
  assert.equal(
    optionErrorMessage("OPTION_REQUIRED_MISSING"),
    "Cette option est obligatoire.",
  );
});

test("maps OPTION_MIN_NOT_MET to a French string", () => {
  assert.equal(
    optionErrorMessage("OPTION_MIN_NOT_MET"),
    "Pas assez de choix pour cette option.",
  );
});

test("maps OPTION_MAX_EXCEEDED to a French string", () => {
  assert.equal(
    optionErrorMessage("OPTION_MAX_EXCEEDED"),
    "Trop de choix pour cette option.",
  );
});

test("maps OPTION_SINGLE_INVALID to a French string", () => {
  assert.equal(
    optionErrorMessage("OPTION_SINGLE_INVALID"),
    "Un seul choix est autorisé pour cette option.",
  );
});

test("maps OPTION_VALUE_INVALID to a French string", () => {
  assert.equal(
    optionErrorMessage("OPTION_VALUE_INVALID"),
    "Ce choix n'est pas valide.",
  );
});

test("maps PRICE_RESOLVED_NEGATIVE to a French string", () => {
  assert.equal(
    optionErrorMessage("PRICE_RESOLVED_NEGATIVE"),
    "Le prix calculé est invalide.",
  );
});

test("every known error code has a non-empty message", () => {
  for (const [code, message] of Object.entries(OPTION_ERROR_MESSAGES)) {
    assert.ok(message.length > 0, `${code} should have a message`);
  }
});
