import assert from "node:assert/strict";
import test from "node:test";
import { getMerchantTabs } from "./merchant-tabs";

test("merchant nav exposes all product tabs in order", () => {
  assert.deepEqual(
    getMerchantTabs(0).map((tab) => tab.label),
    ["Accueil", "Catalogue", "Commandes", "Cuisine", "Clôture", "Fid\u00e9lit\u00e9"],
  );
});
