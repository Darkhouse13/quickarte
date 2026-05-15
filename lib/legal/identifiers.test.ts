import test from "node:test";
import assert from "node:assert/strict";
import {
  QUICKARTE_LEGAL,
  hasIncompleteIdentifiers,
  isPlaceholder,
  type QuickarteLegalIdentifiers,
} from "./identifiers";

test("hasIncompleteIdentifiers is true with the default placeholders", () => {
  assert.equal(hasIncompleteIdentifiers(), true);
});

test("hasIncompleteIdentifiers is false once every placeholder is replaced", () => {
  const filled: QuickarteLegalIdentifiers = {
    companyLegalName: "Quickarte SARL",
    companyShortName: "Quickarte",
    rcNumber: "RC 123456",
    iceNumber: "ICE 001234567000089",
    capitalSocial: "100 000 MAD",
    registeredAddress: "12 rue de l'Exemple, Casablanca",
    publicationDirector: "Prénom Nom",
    contactEmail: "bonjour@quickarte.fr",
    contactWhatsapp: "+212 600 000 000",
    cndpDeclarationNumber: "D-GC-123/2026",
  };
  assert.equal(hasIncompleteIdentifiers(filled), false);
});

test("hasIncompleteIdentifiers stays true if a single placeholder remains", () => {
  const almost: QuickarteLegalIdentifiers = {
    ...QUICKARTE_LEGAL,
    companyLegalName: "Quickarte SARL",
  };
  assert.equal(hasIncompleteIdentifiers(almost), true);
});

test("isPlaceholder detects the À COMPLÉTER prefix", () => {
  assert.equal(isPlaceholder(QUICKARTE_LEGAL.rcNumber), true);
  assert.equal(isPlaceholder(QUICKARTE_LEGAL.contactEmail), false);
});
