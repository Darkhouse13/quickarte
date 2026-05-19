import assert from "node:assert/strict";
import { test } from "node:test";
import { formatAuthErrorMessage } from "./error-messages";

test("formatAuthErrorMessage localizes invalid login errors", () => {
  assert.equal(
    formatAuthErrorMessage("Invalid email or password", "Échec de la connexion"),
    "Email ou mot de passe invalide.",
  );
});

test("formatAuthErrorMessage localizes duplicate account errors", () => {
  assert.equal(
    formatAuthErrorMessage("User already exists", "Échec de la création du compte"),
    "Un compte existe déjà avec cet email.",
  );
});

test("formatAuthErrorMessage uses the French fallback for unknown provider messages", () => {
  assert.equal(
    formatAuthErrorMessage("Unexpected upstream failure", "Échec de la connexion"),
    "Échec de la connexion",
  );
});
