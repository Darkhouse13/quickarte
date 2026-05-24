# Module 4 Design - Recipes, Ingredients, And Stock Engine

Module 4 owns the ingredient catalog, unit conversions, recipe definitions, recipe costing, stock ledger, and automatic stock deduction. This document records the locked decisions for the module and the milestone split. M4.1 implements only the ingredient catalog and conversion engine foundation; recipes, stock movements, and deduction are intentionally deferred to later M4 milestones.

## Locked Decisions

1. Module ownership: Module 4 owns ingredients, units/conversions, recipes, the stock ledger, and manual `current_cost_per_uom`. Module 5 later owns suppliers, purchase orders, goods receiving, inventory counts, transfers, par levels, and automated cost updates from receiving.
2. Supplier seam: `ingredients.supplier_id` is a reserved nullable UUID in M4.1 with no foreign key. Module 5 adds the supplier table and FK once purchasing exists.
3. Numeric discipline: quantities, conversion factors, stock movement quantities, and ingredient costs use Postgres `numeric` and are represented across the API as decimal strings. No JavaScript floating-point math is allowed for stock or money calculations.
4. Tenant model: all Module 4 tenant-owned tables use `business_id` as the RLS tenant key. Branch/location stock is modeled explicitly in stock-ledger tables later; `branch_id` is a location dimension, not the tenant key.
5. Recipe boundary: recipes attach to `product_variants`, because variants are the sellable unit boundary established in Module 3. Product-level recipes are not the source of truth for stock deduction.
6. Modifier seam: `modifier_value_templates.recipe_hook_key` remains inert until M4.4 wires modifier selections to recipe deltas.

## Full Module 4 Model Sketch

### Units And Conversions

`units_of_measure` is a global lookup table, not tenant-scoped. It defines universal same-dimension conversions through `dimension` and `factor_to_base`:

- mass: `g`, `kg`
- volume: `ml`, `l`
- count: `unit`, `dozen`

`ingredient_unit_conversions` stores business-specific, ingredient-specific cross-dimension conversions that cannot be universal. Examples:

- onion stock UOM `g`, alternate `unit`, `qty_in_stock_uom = 150.0000`
- lemon stock UOM `ml`, alternate `unit`, `qty_in_stock_uom = 60.0000`

The conversion helper returns quantities in the ingredient's stock UOM and rounds half-up at 4 decimal places. Same-dimension conversions use factor ratios; cross-dimension conversions require an ingredient conversion row and throw a typed error when missing.

### Ingredients

`ingredients` is business-scoped and strict-RLS protected. It stores name, localized names, category, stock UOM, manual current cost per stock UOM, stock tracking flag, reserved supplier id, storage location, position, timestamps, and soft delete.

Ingredient categories are intentionally broad for Module 4:

- `meat`
- `dairy`
- `vegetable`
- `spice`
- `dry_good`
- `beverage`
- `alcohol`
- `packaging`

### Ingredient Tags

`ingredient_tags` joins ingredients to the existing Module 3 `dietary_tags` catalog. M4.1 only supports manual assignment. Automatic allergen/dietary flow from ingredients through recipes to products is a recipe-time concern for M4.2+.

### Recipes

M4.2 adds recipe tables. The planned shape:

- `recipes`: business id, product variant id, yield quantity/UOM, costing status, timestamps.
- `recipe_lines`: ingredient lines and sub-recipe lines, quantity/UOM, waste/yield adjustment metadata.
- `sub_recipes`: reusable preparations such as sauces, doughs, marinades, batches.
- cost cascade: variant recipe cost = sum ingredient costs + sub-recipe costs, using decimal-safe math.

Recipes attach per variant. A product with small/large/protein variants can have different ingredient quantities and costs per variant.

### Stock Ledger

M4.3 adds the append-only stock ledger and deduction engine. Planned tables:

- stock locations keyed by business and branch.
- stock ledger entries with quantity delta, UOM, reason, source order/item, and actor.
- current stock projection or materialized summary derived from the ledger.

Automatic deduction happens when an order reaches the accepted final state. The engine re-resolves the recipe server-side and writes ledger entries atomically with the order transition.

### Modifier Recipe Deltas

M4.4 wires `modifier_value_templates.recipe_hook_key` and materialized option values into recipe deltas. Example: selecting extra cheese adds a cheese ingredient delta. The placeholder exists now, but no M4.1 logic reads it.

## Milestone Split

### M4.1 - Ingredients + Units

Build the ingredient catalog, units reference data, ingredient-specific conversions, ingredient tags, the pure conversion helper, API endpoints, and strict RLS tests. No recipes or stock movements.

### M4.2 - Recipes + Sub-Recipes + Cost Cascade

Add recipes attached to product variants, recipe lines, sub-recipes/batches, recipe validation, and cost rollups from manual ingredient costs. Build the admin recipe editor.

### M4.3 - Stock Ledger + Deduction Engine

Add branch/location stock ledger, current stock projection, order-completion deduction hook, idempotency, reversal hooks, and audit trail. No purchasing flows; Module 5 owns receiving and supplier cost updates.

### M4.4 - Modifier Delta Wiring + Ingredient Import + Closeout

Wire modifier value recipe hooks into recipe deltas, add ingredient import where needed, close compatibility gaps, document Module 5 handoff, and complete the Module 4 verification sweep.

## Module 5 Handoff

Module 5 must add supplier records, purchase orders, goods receiving, inventory counts, transfers, par levels, and automated cost updates. It should reuse `ingredients.supplier_id`, ingredient stock UOMs, conversion rows, and the stock ledger rather than introducing parallel inventory tables.
