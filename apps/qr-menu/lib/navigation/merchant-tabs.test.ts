import assert from "node:assert/strict";
import test from "node:test";
import { getMerchantTabs } from "./merchant-tabs";

test("merchant nav exposes all product tabs in order", () => {
  assert.deepEqual(
    getMerchantTabs(0).map((tab) => tab.label),
    ["Accueil", "Catalogue", "Commandes", "Cuisine", "Clôture", "Mes habitu\u00e9s"],
  );
});
