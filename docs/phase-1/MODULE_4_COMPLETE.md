# Module 4 Complete — Recipes, Ingredients, and Stock Engine

Module 4 establishes the ingredient, recipe, cost, and stock-deduction foundation that later POS and purchasing modules call into. The work is intentionally API/service-first: Module 6 will invoke the stock engine inside order finalization, and Module 5 will update ingredient costs through receiving.

## Spec Mapping

| Spec section | Status | Notes |
|---|---|---|
| 4.1 Ingredient catalog | Done | `ingredients`, `units_of_measure`, custom ingredient conversions, ingredient allergen tags, soft-delete guard. |
| 4.2 Unit conversion | Done | Decimal-safe conversion helper supports same-dimension global units and ingredient-specific cross-dimension conversions. |
| 4.3 Recipes per sellable variant | Done | `recipes` attach one active recipe per `product_variants.id`; sub-recipes are recipe rows without `variant_id`. |
| 4.4 Sub-recipes and yields | Done | `recipe_lines` supports ingredient and sub-recipe components, cooked yield percentage, and cycle detection at line save. |
| 4.5 Cost cascade | Done | Eager materialized `computed_cost`, `cost_is_complete`, and `food_cost_pct`, recomputed in dependency order. |
| 4.6 Stock ledger and sale deduction | Done | Append-only `stock_movements`, cached `stock_levels`, idempotent sale deduction, reversal via compensating movements. |
| 4.7 Batch/prep recipes | Deferred | Table shape supports sub-recipes, but batch production/consumption workflows are deferred. |
| 4.8 Recipe cards | Deferred | Prep notes/photo fields exist; printable recipe-card UI is deferred. |
| 4.9 Ingredient import and modifier deltas | Done/partial | Ingredient bulk import and modifier ingredient deltas are done; recipe import is deferred. |

## Tables Created

Strict RLS tenant-owned tables:

- `ingredients`
- `ingredient_unit_conversions`
- `ingredient_tags`
- `recipes`
- `recipe_lines`
- `stock_movements`
- `stock_levels`
- `modifier_value_ingredient_deltas`
- `ingredient_import_jobs`

Global reference table:

- `units_of_measure`

Shared catalog tables extended/consumed:

- `product_variants` remains the sellable recipe boundary.
- `modifier_value_templates.recipe_hook_key` remains an optional label only.
- `option_values.template_value_id` is used to resolve selected modifiers to reusable template deltas.

## API Surface

Ingredient and units:

- `GET /v1/units`
- `GET /v1/ingredients`
- `POST /v1/ingredients`
- `GET /v1/ingredients/{ingredientId}`
- `PATCH /v1/ingredients/{ingredientId}`
- `DELETE /v1/ingredients/{ingredientId}`
- `PUT /v1/ingredients/{ingredientId}/conversions`
- `PUT /v1/ingredients/{ingredientId}/tags`

Recipes:

- `GET /v1/recipes`
- `POST /v1/recipes`
- `GET /v1/recipes/by-variant/{variantId}`
- `GET /v1/recipes/{recipeId}`
- `PATCH /v1/recipes/{recipeId}`
- `DELETE /v1/recipes/{recipeId}`
- `PUT /v1/recipes/{recipeId}/lines`

Stock:

- `GET /v1/branches/{branchId}/stock`
- `GET /v1/branches/{branchId}/stock/movements`
- `POST /v1/branches/{branchId}/stock/adjustments`

Modifier deltas and import:

- `PUT /v1/menu/modifier-values/{valueTemplateId}/ingredient-deltas`
- `POST /v1/ingredients/import`
- `GET /v1/ingredients/import/template`
- `GET /v1/ingredients/import/{jobId}`
- `POST /v1/ingredients/import/{jobId}/commit`

There is intentionally no public stock-deduction endpoint in Module 4. Module 6 calls `deductForSaleInTransaction` inside order finalization.

## Deduction Engine

`deductForSaleInTransaction` accepts a tenant transaction, branch, sale reference, sale lines, and selected option values. It explodes each variant recipe into stock-UOM ingredient quantities, walks sub-recipes without visited-once under-deduction, applies cooked yield, applies selected modifier deltas, nets each line, clamps over-subtraction to zero, and writes append-only `sale_deduction` movements plus atomic `stock_levels` updates.

Deduction is idempotent by `(business_id, reference_type, reference_id)` with a DB partial unique index as a race backstop. Negative levels are allowed and returned as alert data. `reverseForSale` writes positive compensating adjustment movements and is itself idempotent.

## Carry-Forward Register

- Deduct-after-reverse behavior: a sale reference that has been deducted cannot be re-deducted even after reversal, because original append-only `sale_deduction` rows remain. Resales must use fresh references. If Module 8 ever needs refund-then-resale under the same reference, the idempotency guard must account for an intervening reversal.
- Modifier over-subtraction clamp: a negative modifier delta cannot make an ingredient deduction negative. The engine clamps the net line quantity to zero and returns a `modifier_delta_clamped_to_zero` configuration warning.
- Modifier clamp warning attribution: when multiple option values are selected, the warning currently reports the first selected option value while the `ingredientId` remains accurate. Improve option-level attribution in a later menu-builder polish pass.
- Combos remain designed but deferred and gated on the first-pilot vertical.
- AR translation pass is owed before GA.
- Batch/prep recipes are deferred from 4.7.
- Recipe cards are deferred from 4.8.
- Recipe bulk import is deferred; ingredient import is complete.
- Modifier-delta UI polish can come with the next menu-builder pass; the API and deduction engine are ready.

## Module 5 Handoff

Module 5 purchasing and inventory operations should:

- Update `ingredients.current_cost_per_uom` from goods receiving, which triggers the Module 4.2 recipe cost cascade.
- Append `receipt`, `transfer_in`, `transfer_out`, `count_correction`, `batch_production`, and `batch_consumption` movements rather than mutating the ledger.
- Use `reconcileLevelsFromLedger` after stock counts or drift repair to rebuild `stock_levels` from the append-only ledger.
- Add supplier FKs to the existing reserved `ingredients.supplier_id` column.
