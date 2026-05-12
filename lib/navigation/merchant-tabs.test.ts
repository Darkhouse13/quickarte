import assert from "node:assert/strict";
import test from "node:test";
import { getMerchantTabs } from "./merchant-tabs";

test("merchant nav always exposes all four product tabs", () => {
  assert.deepEqual(
    getMerchantTabs(0).map((tab) => tab.label),
    ["Accueil", "Catalogue", "Commandes", "Fid\u00e9lit\u00e9"],
  );
});
