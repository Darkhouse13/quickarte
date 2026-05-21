# Module 3 Design - Menu Management

Status: design for PM review. No migrations, controllers, services, or UI were implemented in this milestone.

Core architecture locked by PM: Option A, a shared business-level catalog with branch-level availability, price, tax, routing, and stock-status overrides. `business_id` remains the tenant key. `branch_id` is an operational filter and authorization dimension, never the RLS tenant key.

## Source Documents Read

- `docs/phase-0/MVP_Feature_Spec_v1.md`, Module 3 sections 3.1 through 3.7.
- `docs/phase-0/SPEC_AMENDMENTS.md`.
- `docs/phase-0/RLS_ROLLOUT_PLAN.md`.
- `docs/phase-1/CONVENTIONS.md`.
- `docs/phase-1/MODULE_2_COMPLETE.md`.
- Existing Quickarte catalog, ordering, and print-routing schema/code under:
  - `packages/db-schema/src/schema/catalog.ts`
  - `packages/db-schema/src/schema/ordering.ts`
  - `packages/db-schema/src/schema/business.ts`
  - `apps/qr-menu/lib/catalog/*`
  - `apps/qr-menu/lib/ordering/*`
  - `apps/qr-menu/lib/printing/*`
  - `apps/qr-menu/app/[locale]/(storefront)/[slug]/page.tsx`
  - `apps/qr-menu/app/[locale]/(merchant)/catalog/page.tsx`

## Quickarte Menu Audit

### Current Catalog Tables

Quickarte already has a live business-scoped catalog. These tables are shared production tables and must be extended carefully rather than replaced.

`categories`:

| Column | Current purpose |
|---|---|
| `id uuid PK` | Category identifier. |
| `business_id uuid not null` | Business owner of the category. No RLS today. |
| `name text not null` | Single-language category display name. |
| `position integer default 0` | Business-level category ordering. |
| `visible boolean default true` | Existing QR/merchant visibility flag. |
| `created_at`, `updated_at` | Timestamps. |

Current gaps against Module 3:

- No slug.
- No parent/subcategory relationship.
- No multilingual names.
- No branch-level availability.
- No category tax override.
- No branch-aware print routing.

`products`:

| Column | Current purpose |
|---|---|
| `id uuid PK` | Product identifier. |
| `business_id uuid not null` | Business owner of the item. No RLS today. |
| `category_id uuid null` | Optional category; `ON DELETE SET NULL`. |
| `name text not null` | Single-language product name. |
| `description text null` | Single-language product description. |
| `price numeric(10,2) not null` | Business-level base price. |
| `image text null` | Single primary image URL/path. |
| `available boolean default true` | Existing global availability flag. |
| `position integer default 0` | Product order inside category. |
| `created_at`, `updated_at` | Timestamps. |

Current gaps against Module 3:

- No item code/SKU.
- No color tag.
- No featured/hidden distinction beyond global `available`.
- No channel availability.
- No branch-specific price/availability/tax/86 status.
- No time-of-day schedule.
- No allergen/dietary tagging.
- No KDS station override per item.
- No image gallery.

`product_variants`:

| Column | Current purpose |
|---|---|
| `id uuid PK` | Variant identifier. |
| `product_id uuid not null` | Parent product. |
| `name text not null` | Variant display name. |
| `price_override numeric(10,2) null` | Variant price replacing product base price when present. |
| `position integer default 0` | Variant order. |
| `is_default boolean default false` | One default variant per product via partial unique index. |
| `available boolean default true` | Global variant availability. |
| `option_max_selections_overrides jsonb default '{}'` | Per-variant override for option maximum selection counts. |
| `created_at`, `updated_at` | Timestamps. |

Current gaps against Module 3:

- No explicit first-class "this is the sellable unit" contract yet; current variants are optional customizations over `products.price`.
- No standardized variant kind; current labels are free text, which is useful for Moroccan menus where variants may be sizes, proteins, toppings, or market units.
- No branch-level price override per variant.
- No branch-level variant availability.

`product_options`:

| Column | Current purpose |
|---|---|
| `id uuid PK` | Product-attached option group identifier. |
| `product_id uuid not null` | Parent product. |
| `name text not null` | Option group display name. |
| `type option_type` | `single_select` or `multi_select`. |
| `required boolean default false` | Whether customer must choose. |
| `min_select integer default 0` | Multi-select minimum. |
| `max_select integer null` | Multi-select maximum. |
| `position integer default 0` | Option group order. |
| `available boolean default true` | Global option availability. |
| `created_at`, `updated_at` | Timestamps. |

Current gaps against Module 3:

- Options are product-specific, not reusable across items.
- No business-level reusable modifier group template.
- No Module 4 stock/recipe hook.
- No multilingual names.

`option_values`:

| Column | Current purpose |
|---|---|
| `id uuid PK` | Option value identifier. |
| `option_id uuid not null` | Parent product option. |
| `name text not null` | Value display name. |
| `price_addition numeric(10,2) default 0` | Delta added to item price. |
| `position integer default 0` | Value order. |
| `available boolean default true` | Global value availability. |
| `created_at`, `updated_at` | Timestamps. |

Current gaps against Module 3:

- Values are product-option-specific, not reusable template values.
- No branch-level value availability or price delta override.
- No future recipe/stock delta relation.
- No multilingual names.

### Current QR Storefront Read Shape

The public storefront page at `apps/qr-menu/app/[locale]/(storefront)/[slug]/page.tsx`:

1. Resolves a business by `businesses.slug` using `getBusinessBySlug(slug)`.
2. Loads menu data with `getMenuByBusinessId(business.id)`.
3. Converts DB rows into the existing storefront fixture with `buildStorefrontFixture(business, menu)`.
4. Renders `StorefrontMenu`.

`getMenuByBusinessId()` currently:

- Reads `categories` where `categories.business_id = businessId`.
- Orders categories by `categories.position`.
- Loads `products` under each category where `products.available = true`.
- Orders products by `products.position`.
- Loads all variants ordered by `product_variants.position`.
- Loads all options ordered by `product_options.position`.
- Loads all option values ordered by `option_values.position`.

The resulting storefront DTO shape is:

```ts
{
  slug,
  name,
  location,
  orderingEnabled,
  dineInEnabled,
  takeawayEnabled,
  sections: [
    {
      id: category.id,
      label: category.name,
      items: [
        {
          productId,
          name,
          description,
          price: Number(product.price),
          image,
          hasConfiguration,
          variants: [
            {
              id,
              name,
              priceOverride: Number(variant.priceOverride) | null,
              isDefault,
              available,
              optionMaxSelectionsOverrides
            }
          ],
          options: [
            {
              id,
              name,
              type,
              required,
              minSelect,
              maxSelect,
              available,
              values: [
                { id, name, priceAddition: Number(value.priceAddition), available }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Important compatibility note: current Quickarte QR code converts `numeric` prices to JavaScript numbers. Module 3 API/POS/admin-web must follow the Phase 1 money convention and expose money as decimal strings. The existing QR conversion can remain during the compatibility window, but new API contracts must not copy that number-based money shape.

### Current Merchant Catalog Behavior

The merchant catalog page at `apps/qr-menu/app/[locale]/(merchant)/catalog/page.tsx`:

- Requires a Better Auth web session and `owner` or `manager` role.
- Calls `getAllProductsByBusinessId(business.id)`.
- Displays categories and their products.
- Toggles `products.available`.
- Uses `products.price` for display.

`apps/qr-menu/lib/catalog/actions.ts` creates and updates products directly in `products`, with explicit `business_id` filtering. `apps/qr-menu/lib/catalog/customizations.ts` creates/updates/deletes variants, options, and option values, validating ownership by walking back to the product and checking `products.business_id = business.id`.

These paths are single-location and business-scoped. They must keep working while Module 3 adds branch-aware API behavior.

### Current Ordering Behavior

`apps/qr-menu/lib/ordering/line-validation.ts` validates a QR order line using:

- `products.available`.
- `product_variants.available`.
- `product_options.available`.
- `option_values.available`.
- `product_variants.price_override ?? products.price`.
- `option_values.price_addition`.

It currently uses JavaScript number math and rounds with `Math.round(value * 100) / 100`. This exists in Quickarte's legacy QR order flow. New Module 3 and Module 6 API code must not repeat that pattern; Module 6 must compute order totals server-side with decimal-safe math.

### Current Print Routing

`category_print_routes` is the existing station-routing table:

| Column | Current purpose |
|---|---|
| `business_id uuid not null` | Business owner. No RLS today. |
| `category_id uuid not null` | Category being routed. |
| `station printer_station not null` | `counter`, `kitchen`, or `bar`. |
| `created_at`, `updated_at` | Timestamps. |
| PK | `(business_id, category_id, station)`. |

`apps/qr-menu/lib/printing/routing.ts` implements these rules:

- If an order item has no category, route it to all stations.
- If a category has no explicit `category_print_routes` rows, route it to all stations.
- `counter` is always included as the cashier-facing station even when kitchen/bar rows exist.
- Routing is category-only today; no item-level override exists.

`apps/qr-menu/lib/printing/pipeline.ts` calls `splitOrderItemsByStation()` and then `buildPrintJobsForEnabledPrinters()` to enqueue rows in `print_jobs`. The current pipeline does not use `printer_assignments` yet; it still depends on `printers.station` and `category_print_routes`.

### Existing Schema to Extend

| Spec area | Existing Quickarte schema | Extension direction |
|---|---|---|
| Categories/subcategories | `categories` with `name`, `position`, `visible` | Add nullable parent relationship and multilingual metadata without breaking existing reads; branch behavior goes into override tables. |
| Products/items | `products` with name, description, price, image, available, position | Add catalog metadata columns/tables for SKU, color tag, channel defaults, image gallery, translations; branch behavior goes into override tables. |
| Variants | `product_variants` | Keep as business-level variant list; add branch variant price/availability override table. |
| Options/modifiers | `product_options`, `option_values` | Keep existing product-attached options; add reusable modifier templates and future recipe hook while preserving current QR shape. |
| Allergens/dietary | None | Add tenanted tag tables and product-tag joins. |
| KDS routing | `category_print_routes` | Add branch-aware routing table and item override table; keep legacy table for Quickarte until pipeline refactor. |
| Branch menu | None | Add branch override/effective-menu layer, not `branch_id` directly on products/categories. |

## Design Recommendation

Use the locked Option A model:

- `categories`, `products`, `product_variants`, `product_options`, and `option_values` remain the shared business-level catalog.
- Branch-specific behavior is stored in new branch override tables keyed by both `business_id` and `branch_id`.
- New POS/admin/API reads use an effective-menu resolver: base catalog rows plus the selected branch's overrides.
- Existing Quickarte QR reads continue to work against the base catalog while Module 13 later moves QR traffic to the new branch-aware read API.

This is the lowest-risk path because it:

- Avoids duplicating catalog data for multi-branch owners.
- Keeps central menu management viable.
- Avoids adding `branch_id` to live Quickarte catalog tables before Quickarte is ready.
- Lets single-location restaurants behave like today through their default branch.
- Gives POS terminals a concrete branch-scoped menu snapshot for offline sync.

## Moroccan Menu Field Inputs

PM reviewed eight real Moroccan menus before implementation starts. These inputs change the shape of Module 3 in a few important ways:

- Variants are not a secondary detail. They are the dominant pattern: size variants such as `1/4`, `1/2`, and whole chicken; `0.5L`, `0.75L`, and `1.5L` water; `1m` and `2m` pizza; and protein/topping variants such as couscous by protein, patata by topping, and tajin variants. Module 3 must make variants first-class, with independent prices. The menu-builder UX must make "one item with five priced variants" fast, not five separate products.
- Modifier groups need required/optional, single/multi-select, min/max counts, per-option price impact, and category-wide attachment. Real cases include "sauce au choix" across grillades and "2 garnitures au choix" where extras cost more.
- Combos are common in traditional Moroccan restaurants, not rare: `Menu Complet = entree + plat + dessert + soda`, with price driven by the chosen main protein, and `Menu Kids = plat + frites + jus`.
- Time availability must include day-of-week rules in addition to dayparts and Ramadan. Example: couscous every Friday.
- Seafood menus need variable/market/weight pricing. Display ranges such as `400-450 dh/kg` are display metadata. The final sale price must be entered at POS as a decimal string and computed server-side.
- Menu content i18n cannot be hardcoded to French/Arabic/Darija columns. Real menus include Arabic-only, Spanish/French/English, French-only, and French with inline Arabic. Darija was not seen on the reviewed written menus. The data model should use flexible locale-to-text maps and a restaurant-configured active menu locale list.
- Dietary tags are customer-facing in the wild, including vegetarian leaf icons on pizzas. The public QR menu API must expose them.

These are design inputs, not new implementation scope in this design milestone.

## Proposed Data Model

All table sketches are design-level only. They are not migration files.

### Menu Content Locale Model

Do not add fixed `name_fr`, `name_ar`, or `name_darija` columns to menu tables.

New `menu_locale_settings`:

```ts
menu_locale_settings {
  business_id uuid primary key,
  active_locales jsonb not null default '["fr"]',
  default_locale varchar(16) not null default 'fr',
  created_at timestamptz not null,
  updated_at timestamptz not null
}
```

Rules:

- Locale keys use BCP-47-ish strings such as `fr`, `ar`, `es`, `en`, and potentially `ary`/`darija` if PM later wants a Darija slot.
- Menu content fields use JSON maps such as `localized_names jsonb` and `localized_descriptions jsonb`.
- Existing `name` and `description` text columns stay as compatibility fallbacks for Quickarte and old reports.
- New APIs resolve display text by requested locale -> business default locale -> legacy fallback column.
- Admin UI lets the restaurant choose active menu content locales. App chrome i18n remains separate in `packages/i18n`.

### 3.1 Menu Structure: Categories And One-Level Subcategories

Extend existing `categories`:

```ts
categories add {
  parent_id uuid null references categories(id) on delete set null,
  slug varchar(96) null,
  description text null,
  localized_names jsonb not null default '{}'::jsonb,
  localized_descriptions jsonb not null default '{}'::jsonb,
  color_tag varchar(32) null,
  deleted_at timestamptz null
}
```

Rules:

- `parent_id` supports one-level subcategories only. A category whose `parent_id` is not null cannot itself have children. Enforce in service logic; add a DB trigger only if needed after implementation starts.
- Existing `categories.name` remains the fallback/display name used by Quickarte.
- New admin API writes `name` from the default active locale when `name` is missing, keeping Quickarte compatible.
- `visible` remains the business-level default.
- Do not add `branch_id` to `categories`.

New `branch_category_overrides`:

```ts
branch_category_overrides {
  id uuid pk,
  business_id uuid not null,
  branch_id uuid not null references branches(id),
  category_id uuid not null references categories(id),
  visible boolean null,
  position integer null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(branch_id, category_id)
}
```

Purpose:

- Branch-specific category visibility and ordering.
- If no row exists, the branch inherits `categories.visible` and `categories.position`.
- Strict RLS because it is new tenant-scoped infrastructure.

Bulk import:

- Design the import service to upsert the shared catalog first, then optional branch overrides.
- CSV/Excel implementation should be a later Module 3 milestone after base CRUD is stable.

### 3.2 Products / Items

Extend existing `products`:

```ts
products add {
  sku varchar(64) null,
  item_code varchar(64) null,
  localized_names jsonb not null default '{}'::jsonb,
  localized_descriptions jsonb not null default '{}'::jsonb,
  color_tag varchar(32) null,
  featured boolean not null default false,
  hidden boolean not null default false,
  available_dine_in boolean not null default true,
  available_takeaway boolean not null default true,
  available_delivery boolean not null default true,
  available_qr boolean not null default true,
  available_online boolean not null default true,
  deleted_at timestamptz null
}
```

Rules:

- Existing `products.name`, `products.description`, `products.price`, `products.image`, `products.available`, and `products.position` stay in place.
- Existing `products.price` remains the business-level base price.
- New API responses expose all money fields as strings.
- `products.available` remains the business-level master switch. A product disabled globally is not available in any branch.
- Module 3 treats variants as the sellable price carriers. Every product should have at least one default variant in the new API model. Existing `products.price` remains the Quickarte compatibility/base fallback.
- `hidden` means hidden from customer-facing channels; staff/admin can still see it.
- `featured` is a customer-facing merchandising flag.
- Do not add `branch_id` to `products`.

New `product_images`:

```ts
product_images {
  id uuid pk,
  business_id uuid not null,
  product_id uuid not null references products(id),
  url text not null,
  alt_text text null,
  position integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(product_id, position)
}
```

Purpose:

- Supports more than one image without breaking existing `products.image`.
- On create/update, keep `products.image` equal to the primary image for Quickarte compatibility.
- Strict RLS if created as a new table.

New `branch_product_overrides`:

```ts
branch_product_overrides {
  id uuid pk,
  business_id uuid not null,
  branch_id uuid not null references branches(id),
  product_id uuid not null references products(id),
  available boolean null,
  is_86d boolean not null default false,
  eighty_sixed_at timestamptz null,
  eighty_sixed_by_user_id uuid null,
  eighty_six_reason text null,
  featured boolean null,
  hidden boolean null,
  available_dine_in boolean null,
  available_takeaway boolean null,
  available_delivery boolean null,
  available_qr boolean null,
  available_online boolean null,
  position integer null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(branch_id, product_id)
}
```

Purpose:

- Branch-level channel availability, featured/hidden overrides, and 86/in-stock status.
- If no row exists, inherit all business-level product defaults.
- `is_86d = true` always makes the item unavailable for sale in that branch until cleared.
- Strict RLS.

New `branch_product_price_overrides`:

```ts
branch_product_price_overrides {
  id uuid pk,
  business_id uuid not null,
  branch_id uuid not null references branches(id),
  product_id uuid not null references products(id),
  variant_id uuid not null references product_variants(id),
  price numeric(10, 2) not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(branch_id, variant_id)
}
```

Purpose:

- Branch-specific price overrides for variants. This is intentionally per-variant, not per-item, because real Moroccan menus price the sellable item through variants: chicken quarter/half/whole, couscous by protein, tajin by type, pizza by meter, and drink sizes.
- API exposes `price` as a decimal string.
- Resolver precedence:
  1. Branch variant override.
  2. Business-level variant `price_override`.
  3. Business-level `products.price` as legacy/default-variant fallback.
- Strict RLS.

Implementation rule:

- The admin menu builder must make creating many variants on one product fast: add product once, add variant rows inline, tab through names/prices, and save atomically.
- Products with no explicit variants in old Quickarte data should be presented by the new API as having a synthetic/default variant sourced from `products.price` until a real `product_variants` row is created.

New variable pricing metadata on `product_variants`:

```ts
product_variants add {
  variant_kind varchar(32) null, // size | protein | topping | market | weight | custom
  pricing_mode varchar(32) not null default 'fixed', // fixed | variable_pos
  display_price_label text null, // e.g. "selon arrivage"
  display_price_min numeric(10,2) null,
  display_price_max numeric(10,2) null,
  unit_label text null // kg | piece | meter | portion
}
```

Rules:

- `pricing_mode = 'fixed'` uses the normal effective price resolver.
- `pricing_mode = 'variable_pos'` means the POS must collect the final sale price as a decimal string at order time, optionally with weight/unit metadata.
- Display ranges are not used for computation; they are customer-facing metadata only.

### 3.3 Modifiers / Options

The current `product_options` and `option_values` tables already support product-specific modifiers. Module 3 needs reusable modifier groups.

Recommendation: introduce reusable templates, then attach them to products while keeping the current product-attached tables as the QR-compatible rendered instance layer.

New `modifier_group_templates`:

```ts
modifier_group_templates {
  id uuid pk,
  business_id uuid not null,
  name text not null,
  localized_names jsonb not null default '{}'::jsonb,
  type option_type not null,
  required boolean not null default false,
  min_select integer not null default 0,
  max_select integer null,
  free_quantity integer not null default 0,
  extra_price numeric(10,2) null,
  attach_scope varchar(32) not null default 'product', // product | category
  reusable boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null
}
```

New `modifier_value_templates`:

```ts
modifier_value_templates {
  id uuid pk,
  business_id uuid not null,
  group_template_id uuid not null references modifier_group_templates(id),
  name text not null,
  localized_names jsonb not null default '{}'::jsonb,
  price_addition numeric(10, 2) not null default 0,
  position integer not null default 0,
  available boolean not null default true,
  recipe_hook_key text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null
}
```

Recipe/stock hook for Module 4:

- `recipe_hook_key` is a placeholder identifier only. Module 4 owns the real recipe/ingredient/stock linkage and may replace this with a proper join table such as `modifier_value_recipe_deltas`.
- Module 3 must not implement ingredient deduction.

Extend existing product-attached option tables:

```ts
product_options add {
  template_id uuid null references modifier_group_templates(id),
  localized_names jsonb not null default '{}'::jsonb,
  free_quantity integer not null default 0,
  extra_price numeric(10,2) null
}

option_values add {
  template_value_id uuid null references modifier_value_templates(id),
  localized_names jsonb not null default '{}'::jsonb
}
```

Why this hybrid model:

- Existing Quickarte QR/order code already understands `product_options` and `option_values`.
- Reusable groups can be materialized as product-attached option rows, preserving the current QR read shape.
- Product-specific exceptions remain possible.
- Future Module 13 can switch QR to the effective-menu API without urgent table rewrites.

Quantity-tiered modifier pricing:

- Data model supports a free quota through `free_quantity` and a uniform extra price through `extra_price`.
- Example: "2 garnitures au choix" with extra garnish `+10.00` after the first two.
- Recommendation: support this in the MVP if implementation complexity stays localized to modifier validation and price calculation. It appears in real reviewed menus and affects order totals, so deferring it creates rework in Module 6.

Category-wide modifiers:

- `attach_scope = 'category'` allows groups like "sauce au choix" across all grillades.
- Implementation can represent category attachment with a join table:

```ts
category_modifier_groups {
  business_id uuid not null,
  category_id uuid not null references categories(id),
  group_template_id uuid not null references modifier_group_templates(id),
  position integer not null default 0,
  primary key(category_id, group_template_id)
}
```

Branch-level modifier overrides:

```ts
branch_option_value_overrides {
  id uuid pk,
  business_id uuid not null,
  branch_id uuid not null references branches(id),
  option_value_id uuid not null references option_values(id),
  available boolean null,
  price_addition numeric(10, 2) null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(branch_id, option_value_id)
}
```

Purpose:

- Allows a branch to disable or price-adjust a modifier value.
- Strict RLS.
- API money fields are decimal strings.

### 3.4 Combos

Spec status: Should-have, but PM's reviewed Moroccan menus show combos are common in traditional restaurants. Design them now and treat implementation as a PM product decision rather than assuming they are rare.

New `menu_combos`:

```ts
menu_combos {
  id uuid pk,
  business_id uuid not null,
  name text not null,
  localized_names jsonb not null default '{}'::jsonb,
  description text null,
  localized_descriptions jsonb not null default '{}'::jsonb,
  base_price numeric(10,2) null,
  pricing_mode varchar(32) not null default 'fixed', // fixed | main_selection
  image_url text null,
  available boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null
}
```

New `menu_combo_slots`:

```ts
menu_combo_slots {
  id uuid pk,
  business_id uuid not null,
  combo_id uuid not null references menu_combos(id),
  name text not null,
  localized_names jsonb not null default '{}'::jsonb,
  slot_type varchar(32) not null default 'component', // component | main_pricing
  min_select integer not null default 1,
  max_select integer not null default 1,
  position integer not null default 0
}
```

New `menu_combo_slot_products`:

```ts
menu_combo_slot_products {
  id uuid pk,
  business_id uuid not null,
  slot_id uuid not null references menu_combo_slots(id),
  product_id uuid not null references products(id),
  variant_id uuid null references product_variants(id),
  price_delta numeric(10,2) not null default 0,
  combo_price numeric(10,2) null,
  position integer not null default 0
}
```

Combo pricing rules:

- `pricing_mode = 'fixed'`: combo base price plus optional slot product deltas.
- `pricing_mode = 'main_selection'`: chosen product/variant in the `main_pricing` slot determines the combo price. This supports "Menu Complet" where chicken, meat, seafood, or premium protein changes the total from roughly 140 to 300 MAD.
- Menu Kids works as fixed price with required slots.
- Recommendation: include combo implementation in MVP if the target first pilot has traditional dine-in menus; otherwise design now and implement in v1.1 after core item/modifier flow. PM decision required.

New `branch_combo_overrides`:

```ts
branch_combo_overrides {
  id uuid pk,
  business_id uuid not null,
  branch_id uuid not null references branches(id),
  combo_id uuid not null references menu_combos(id),
  available boolean null,
  price numeric(10,2) null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(branch_id, combo_id)
}
```

### 3.5 Allergens / Dietary Tags

New `menu_tags`:

```ts
menu_tags {
  id uuid pk,
  business_id uuid not null,
  code varchar(64) not null,
  kind varchar(32) not null, // allergen | dietary | custom
  label text not null,
  localized_labels jsonb not null default '{}'::jsonb,
  icon text null,
  color_tag varchar(32) null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(business_id, code)
}
```

New `product_tags`:

```ts
product_tags {
  business_id uuid not null,
  product_id uuid not null references products(id),
  tag_id uuid not null references menu_tags(id),
  source varchar(32) not null default 'manual', // manual | recipe
  created_at timestamptz not null,
  primary key(product_id, tag_id)
}
```

Rules:

- Module 3 supports manual tags.
- Module 4 may add recipe-derived tags by inserting/updating `product_tags.source = 'recipe'`.
- Public QR/effective-menu responses include consumer-facing dietary tags and icons.
- Strict RLS for new tenanted tables.

### 3.6 KDS Routing

Keep existing `category_print_routes` untouched for Quickarte.

New `branch_category_print_routes`:

```ts
branch_category_print_routes {
  business_id uuid not null,
  branch_id uuid not null references branches(id),
  category_id uuid not null references categories(id),
  station varchar(32) not null, // counter | kitchen | bar, future station ids later
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key(branch_id, category_id, station)
}
```

New `branch_product_print_routes`:

```ts
branch_product_print_routes {
  business_id uuid not null,
  branch_id uuid not null references branches(id),
  product_id uuid not null references products(id),
  station varchar(32) not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key(branch_id, product_id, station)
}
```

Resolver precedence:

1. Product-level branch routes if present.
2. Category-level branch routes if present.
3. Existing business-level `category_print_routes` for compatibility fallback.
4. All stations if no explicit routing exists, preserving current Quickarte behavior.
5. Counter station remains included for cashier copies unless explicitly changed in Module 6/8 KDS/receipt work.

Strict RLS for the new branch routing tables.

### 3.7 Time-Based Menus

Spec status: Should-have, but data model must not block it.

New `menu_availability_windows`:

```ts
menu_availability_windows {
  id uuid pk,
  business_id uuid not null,
  name text not null,
  schedule_type varchar(24) not null default 'normal', // normal | ramadan
  day_of_week smallint not null,
  starts_at time not null,
  ends_at time not null,
  valid_from date null,
  valid_until date null,
  created_at timestamptz not null,
  updated_at timestamptz not null
}
```

New `branch_product_availability_windows`:

```ts
branch_product_availability_windows {
  id uuid pk,
  business_id uuid not null,
  branch_id uuid not null references branches(id),
  product_id uuid not null references products(id),
  window_id uuid not null references menu_availability_windows(id),
  created_at timestamptz not null,
  unique(branch_id, product_id, window_id)
}
```

Rules:

- If a product has no windows, it is available whenever the branch is open, subject to global/branch availability flags.
- If one or more windows exist for a branch/product, it is available only during matching windows.
- Day-of-week is first-class. Example: couscous can be available only on Friday, with or without a time window.
- Ramadan-specific schedule type should align with Module 2's `branch_schedule_settings.ramadan_mode_enabled`.

### Category/Product Tax Overrides

Module 2 created `tax_rates` and `branch_tax_settings`. Module 3 adds the deferred override layer.

New `branch_category_tax_overrides`:

```ts
branch_category_tax_overrides {
  id uuid pk,
  business_id uuid not null,
  branch_id uuid not null references branches(id),
  category_id uuid not null references categories(id),
  tax_rate_id varchar(64) not null references tax_rates(id),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(branch_id, category_id)
}
```

New `branch_product_tax_overrides`:

```ts
branch_product_tax_overrides {
  id uuid pk,
  business_id uuid not null,
  branch_id uuid not null references branches(id),
  product_id uuid not null references products(id),
  tax_rate_id varchar(64) not null references tax_rates(id),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(branch_id, product_id)
}
```

Tax resolution:

1. Branch product tax override.
2. Branch category tax override.
3. Branch default tax from `branch_tax_settings.default_tax_rate_id`.
4. Service-level fallback `ma_tva_10` if no branch tax settings row exists.

## Effective Menu Resolution

For branch X, the effective menu is computed as:

1. Load shared business catalog:
   - categories
   - products
   - variants
   - product options
   - option values
   - tags/images/modifier templates where relevant
2. Load branch overrides:
   - category overrides
   - product overrides
   - variant price overrides
   - option value overrides
   - category/product tax overrides
   - print routes
   - availability windows
3. Filter:
   - exclude soft-deleted catalog rows
   - exclude categories/products hidden globally
   - exclude category/product rows disabled by branch override
   - exclude channel-unavailable rows for the requested channel
   - exclude 86d products
   - exclude rows outside their active time window
4. Sort:
   - branch override position if present
   - otherwise shared catalog position
5. Resolve money/tax:
   - effective price from branch override -> variant override -> product override -> base product price
   - effective tax from product override -> category override -> branch default -> service fallback
6. Return decimal money fields as strings.

This resolver should exist server-side in the API. POS can cache the already-resolved branch snapshot for display, but order validation must still re-resolve server-side when syncing/submitting.

## Answers To Module 2 Open Questions

### How categories/products become branch-aware without breaking Quickarte QR assumptions

Categories and products stay business-level. Branch awareness is added through new branch override tables. Quickarte's current QR code can keep using `getMenuByBusinessId()` and the old business-level fields while the new API exposes branch-effective reads.

During Module 13, QR traffic moves to the new effective-menu API. Until then, default-branch behavior can be mirrored by keeping base catalog fields aligned with the default branch where needed.

### Whether `branch_id` goes directly on menu tables or only through overrides

Recommendation: do not add `branch_id` directly to `categories`, `products`, `product_variants`, `product_options`, or `option_values`.

Reasoning:

- PM locked shared catalog architecture.
- Direct `branch_id` on catalog rows would turn the catalog into per-branch duplication.
- Existing Quickarte reads assume one catalog per business.
- Cross-branch menu management becomes much cleaner when base items are shared and branch differences are explicit override rows.

### How category-to-printer routing becomes branch-aware without breaking `category_print_routes`

Keep `category_print_routes` as the legacy business-level fallback used by Quickarte. Add new strict-RLS branch routing tables:

- `branch_category_print_routes`
- `branch_product_print_routes`

The new API/KDS/POS resolver uses branch routes first and falls back to the legacy table only when branch routes are absent. The existing Quickarte print pipeline keeps reading `category_print_routes` until Module 6/8 refactors the pipeline to branch-aware routing.

### How the effective per-branch menu enters POS offline sync tables

POS terminal should pull a denormalized branch-effective snapshot, not raw business catalog plus every override table at first.

Recommended WatermelonDB tables for Module 3:

- `menu_categories`
  - `id`
  - `business_id`
  - `branch_id`
  - `parent_id`
  - `localized_names`
  - `localized_descriptions`
  - `position`
  - `visible`
  - `updated_at`
- `menu_products`
  - `id`
  - `business_id`
  - `branch_id`
  - `category_id`
  - `localized_names`
  - `localized_descriptions`
  - `effective_price`
  - `pricing_mode`
  - `display_price_min`
  - `display_price_max`
  - `unit_label`
  - `effective_tax_rate_id`
  - `sku`, `item_code`, `color_tag`
  - `featured`, `hidden`, `is_86d`
  - channel flags
  - `updated_at`
- `menu_product_variants`
  - effective variant price as a decimal string
- `menu_product_options`
- `menu_option_values`
  - effective price addition as a decimal string
- `menu_product_tags`
- `menu_print_routes`

The API sync endpoint can expose these as derived tables in the pull payload. The terminal does not need to recompute override precedence for display in Phase 1. However, it should keep enough source IDs (`product_id`, `variant_id`, `option_value_id`, `effective_version`) for order submission and later conflict/debug handling.

### The QR-menu-facing read API (`GET /menu`) and per-branch effective menu

Module 13 will move the existing QR menu app to the API. Design the API now:

```http
GET /v1/public/menu?businessSlug=cafe-atlas&branchSlug=main&channel=qr
```

or, if the public router already resolved tenant/branch:

```http
GET /v1/menu?branchId=<uuid>&channel=qr
```

Response shape should be a public-safe effective menu:

```ts
{
  business: { id, slug, name, logo, locale, currency },
  branch: { id, slug, name, timezone, locale },
  channels: { dineInEnabled, takeawayEnabled, deliveryEnabled, qrEnabled },
  categories: [
    {
      id,
      parentId,
      name: Record<locale, text>,
      position,
      products: [
        {
          id,
          name: Record<locale, text>,
          description: Record<locale, text>,
          effectivePrice: "42.50",
          pricingMode: "fixed",
          displayPriceRange: null,
          effectiveTaxRateId,
          image,
          images,
          featured,
          tags,
          variants,
          modifierGroups
        }
      ]
    }
  ],
  generatedAt,
  menuVersion
}
```

Public QR responses should never expose internal cost, audit, staff, deleted, or hidden-only metadata.

## API Surface Proposal

All endpoints are under `/v1`, OpenAPI-documented, SDK-generated, typed with request DTOs and response DTOs per `docs/phase-1/CONVENTIONS.md`, permission-guarded, and executed inside `withTenant()`.

### Catalog Categories

| Method/path | Purpose | Permission | Request sketch | Response sketch |
|---|---|---|---|---|
| `GET /v1/menu/categories` | List shared categories and subcategories. | `menu.view` | `includeHidden?: boolean` | `{ categories: CategoryDto[] }` |
| `POST /v1/menu/categories` | Create category/subcategory. | `menu.manage` | name translations, `parentId`, color, position | `CategoryDto` |
| `PATCH /v1/menu/categories/{categoryId}` | Update category metadata. | `menu.manage` | partial metadata | `CategoryDto` |
| `DELETE /v1/menu/categories/{categoryId}` | Soft-delete category if safe. | `menu.manage` | none | `{ deleted: true }` |
| `PUT /v1/menu/categories/reorder` | Reorder top-level and one-level children. | `menu.manage` | ordered IDs | `{ categories: CategoryDto[] }` |

### Products

| Method/path | Purpose | Permission | Request sketch | Response sketch |
|---|---|---|---|---|
| `GET /v1/menu/products` | List shared products. | `menu.view` | filters by category, search, hidden | `{ products: ProductSummaryDto[] }` |
| `POST /v1/menu/products` | Create shared product. | `menu.manage` | category, names/descriptions, variants with decimal-string prices, channels, SKU, image | `ProductDetailDto` |
| `GET /v1/menu/products/{productId}` | Get product detail. | `menu.view` | none | `ProductDetailDto` |
| `PATCH /v1/menu/products/{productId}` | Update shared product metadata. | `menu.manage` | partial metadata | `ProductDetailDto` |
| `DELETE /v1/menu/products/{productId}` | Soft-delete product. | `menu.manage` | none | `{ deleted: true }` |
| `PUT /v1/menu/products/reorder` | Reorder products inside categories. | `menu.manage` | category IDs and ordered product IDs | `{ products: ProductSummaryDto[] }` |
| `POST /v1/menu/products/import` | Bulk import CSV/Excel. | `menu.manage` | upload/import job payload | `ImportJobDto` |

### Variants, Images, Modifiers

| Method/path | Purpose | Permission | Request sketch | Response sketch |
|---|---|---|---|---|
| `PUT /v1/menu/products/{productId}/variants` | Atomic replace variants. | `menu.manage` | variants with price strings/default flag | `{ variants: VariantDto[] }` |
| `PUT /v1/menu/products/{productId}/images` | Atomic replace gallery. | `menu.manage` | URLs, alt text, primary flag | `{ images: ProductImageDto[] }` |
| `GET /v1/menu/modifier-groups` | List reusable modifier templates. | `menu.view` | search/filter | `{ groups: ModifierGroupDto[] }` |
| `POST /v1/menu/modifier-groups` | Create reusable group. | `menu.manage` | group + values | `ModifierGroupDto` |
| `PATCH /v1/menu/modifier-groups/{groupId}` | Update reusable group. | `menu.manage` | partial group + values | `ModifierGroupDto` |
| `PUT /v1/menu/products/{productId}/modifier-groups` | Attach/configure groups for a product. | `menu.manage` | ordered groups and product-specific overrides | `{ groups: ProductModifierGroupDto[] }` |

### Tags

| Method/path | Purpose | Permission | Request sketch | Response sketch |
|---|---|---|---|---|
| `GET /v1/menu/tags` | List allergen/dietary tags. | `menu.view` | kind filter | `{ tags: MenuTagDto[] }` |
| `POST /v1/menu/tags` | Create custom tag. | `menu.manage` | code, kind, labels | `MenuTagDto` |
| `PUT /v1/menu/products/{productId}/tags` | Replace product tags. | `menu.manage` | tag IDs | `{ tags: MenuTagDto[] }` |

### Branch Overrides And Effective Menu

| Method/path | Purpose | Permission | Request sketch | Response sketch |
|---|---|---|---|---|
| `GET /v1/branches/{branchId}/menu/effective` | Return fully resolved branch menu. | `menu.view` | `channel`, `at` timestamp | `EffectiveMenuDto` |
| `GET /v1/branches/{branchId}/menu-overrides` | Load all branch overrides for admin editing. | `menu.view` | none | `BranchMenuOverridesDto` |
| `PUT /v1/branches/{branchId}/menu-overrides` | Atomic replace branch overrides. | `menu.manage` | categories, products, price, tax, availability | `BranchMenuOverridesDto` |
| `PATCH /v1/branches/{branchId}/products/{productId}/availability` | Fast 86/channel update. | `menu.manage` or `order.update` | `is86d`, channel flags, reason | `BranchProductOverrideDto` |
| `PUT /v1/branches/{branchId}/products/{productId}/prices` | Replace branch variant prices. | `menu.manage` | variant-scoped decimal string prices | `{ prices: BranchProductPriceDto[] }` |
| `PUT /v1/branches/{branchId}/menu-tax-overrides` | Replace category/product tax overrides. | `menu.manage` or `tax.update` | tax override rows | `MenuTaxOverridesDto` |
| `PUT /v1/branches/{branchId}/menu-print-routes` | Replace branch category/product station routes. | `printer.manage` | routing rows | `MenuPrintRoutesDto` |

### Public QR Menu

| Method/path | Purpose | Permission | Request sketch | Response sketch |
|---|---|---|---|---|
| `GET /v1/public/menu` | Public branch-effective menu for QR/online channels. | Public, rate-limited | `businessSlug`, `branchSlug`, `channel=qr|online` | `PublicMenuDto` |

### POS Sync Surface

Existing M6 sync endpoints should add derived menu tables to `GET /v1/sync/pull`:

- `menu_categories`
- `menu_products`
- `menu_product_variants`
- `menu_product_options`
- `menu_option_values`
- `menu_product_tags`
- `menu_print_routes`

M3 should not add menu writes from POS except stock/86 changes if PM wants fast item availability from the terminal. Full POS order writes are Module 6.

## Variable / Market / Weight Pricing

Real seafood menus often display prices as `au kg`, `selon arrivage`, or a range such as `400-450 dh`. This is a separate concept from fixed menu prices.

Design:

- Variant-level `pricing_mode = 'variable_pos'`.
- Optional display-only fields: `display_price_label`, `display_price_min`, `display_price_max`, `unit_label`.
- POS order entry requires the cashier to enter the final unit price as a decimal string, and optionally weight/quantity metadata.
- Server validates the entered price and computes totals with decimal-safe math.
- Display ranges are never used to compute totals automatically.

Recommendation:

- Support variable price entered at POS in the MVP for the POS/API model, because Moroccan seafood and market-price items are common enough that pretending they are fixed-price creates bad workarounds.
- Keep the first implementation narrow: no scale integration, no automatic kg price multiplication in Module 3. Module 6 can collect `entered_unit_price` and optional `entered_weight`.

## RLS Plan

### New Tables With Strict RLS

Any new tenanted table created by Module 3 must include `business_id`, `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, and the standard fail-closed policy in the same migration.

Strict-RLS tables:

- `menu_locale_settings`
- `branch_category_overrides`
- `product_images`
- `branch_product_overrides`
- `branch_product_price_overrides`
- `modifier_group_templates`
- `modifier_value_templates`
- `category_modifier_groups`
- `branch_option_value_overrides`
- `menu_tags`
- `product_tags`
- `menu_combos`
- `menu_combo_slots`
- `menu_combo_slot_products`
- `branch_combo_overrides`
- `branch_category_tax_overrides`
- `branch_product_tax_overrides`
- `branch_category_print_routes`
- `branch_product_print_routes`
- `menu_availability_windows`
- `branch_product_availability_windows`

Policy pattern:

```sql
USING (
  business_id = nullif(current_setting('app.current_business_id', true), '')::uuid
)
WITH CHECK (
  business_id = nullif(current_setting('app.current_business_id', true), '')::uuid
)
```

### Existing Quickarte-Shared Tables With Deferred RLS

These tables remain on the RLS rollout plan and must use explicit `business_id` filtering in every new API query:

- `categories`
- `products`
- `product_variants`
- `product_options`
- `option_values`
- `category_print_routes`
- legacy order tables touched by QR order validation

Reason:

- Quickarte still reads/writes these tables directly outside the API `withTenant()` helper.
- Enabling strict RLS now would risk breaking live QR menu/admin/order flows.
- This is the same compatibility pattern used for `printers`.

### Isolation Rule

Every API service method that touches Quickarte-shared catalog tables must prove tenant isolation with explicit `business_id` joins or ownership checks. Tests should include a case that would fail if the explicit business filter were removed.

## drizzle-zod / nestjs-zod Evaluation

### Problem

Module 3 introduces many schemas:

- catalog create/update DTOs
- variants
- image galleries
- modifiers
- tags
- branch overrides
- effective-menu responses
- POS sync payloads
- public QR menu payloads

Continuing with hand-maintained Drizzle schema + class-validator DTO classes + OpenAPI response DTO classes increases drift risk.

### Options

Option A: Keep current class-validator + `@ApiProperty` pattern.

Pros:

- Already proven through Phase 0 and Module 2.
- Nest Swagger output is predictable.
- Generated SDK quality is known.
- No migration risk.

Cons:

- Lots of duplicated schema definitions.
- Higher chance of request/response drift.
- More boilerplate for Module 3 and Module 4.

Option B: Adopt `drizzle-zod` only for internal validation, keep Nest DTO classes for controller/OpenAPI.

Pros:

- DB-adjacent validation can be generated from Drizzle tables.
- Lower risk than replacing Nest DTO pattern.
- Can coexist with current controllers.

Cons:

- Still duplicates OpenAPI response DTOs.
- Request DTOs may still need adapter classes.
- Does not fully solve SDK schema drift.

Option C: Adopt `drizzle-zod` + `nestjs-zod` for new Module 3 endpoints.

Pros:

- Zod schemas can become the source for request validation and OpenAPI metadata for new endpoints.
- Reduces manual DTO duplication.
- Fits the existing Quickarte codebase, which already uses Zod in several server actions.
- Better for complex nested menu payloads than class-validator decorators.

Cons:

- Needs a small integration spike before feature work.
- We must prove OpenAPI output is precise enough for `openapi-typescript`.
- Response DTO conventions in `docs/phase-1/CONVENTIONS.md` would need an amendment to allow Zod DTOs created with `createZodDto`.
- Mixed class-validator and Zod DTOs will coexist for a while.
- Decimal-string money fields must be explicit in Zod schemas; generated schemas must not infer numeric prices.

### Recommendation

Adopt Option C at the start of Module 3 implementation as a dedicated M3.0 infrastructure milestone.

Guardrails:

- Use `drizzle-zod` to derive base insert/select schemas where it helps, but hand-author public API schemas when the wire shape differs from the DB shape.
- Use `nestjs-zod` / `createZodDto` for new Module 3 request and response DTOs only.
- Do not retrofit Phase 0 or Module 2 endpoints.
- Keep generated OpenAPI and SDK freshness as acceptance criteria.
- Add a test proving `packages/shared-types/src/api.ts` contains precise types for one nested menu response.
- If the spike produces weak OpenAPI or requires unsafe casts in admin/POS, stop and fall back to current class-validator DTOs for Module 3.

PM decision needed: approve or reject M3.0 Zod adoption before implementation begins.

## Proposed Implementation Milestones

### M3.0 - DTO/Zod Infrastructure Decision Spike

Scope:

- If PM approves, add `drizzle-zod` and `nestjs-zod`.
- Create conventions for decimal strings, enum schemas, request/response DTO generation, and Swagger wiring.
- Convert no existing endpoints.
- Add one small non-production sample or test-only schema to prove OpenAPI and SDK generation.

Acceptance:

- SDK types are precise.
- No `as unknown as` casts are needed.
- `docs/phase-1/CONVENTIONS.md` is updated for Zod DTOs if adopted.

### M3.1 - Shared Catalog And First-Class Variants

Scope:

- Extend categories/products for multilingual fields, subcategories, SKU/item code, color tags, featured/hidden, channel defaults, soft delete.
- Add flexible menu locale settings.
- Add product images.
- Make variants first-class in the API and admin UX: fast inline creation of size/protein/topping variants with independent decimal-string prices.
- Add variable/market-price variant metadata, but no POS order entry yet.
- Add category/product CRUD APIs and admin Menu Catalog screens.
- Keep Quickarte QR compatibility fields populated.

Acceptance:

- Existing Quickarte catalog tests still pass.
- Admin can manage shared catalog and variant prices without creating duplicate products.
- No branch override behavior yet except default inheritance.

### M3.2 - Reusable Modifiers And Category-Wide Attachments

Scope:

- Add reusable modifier templates and product attachment flow.
- Add category-wide modifier attachment flow.
- Add quantity-tiered modifier pricing if PM approves it for MVP.
- Keep current `product_options` / `option_values` as QR-compatible rendered product modifiers.
- Add recipe hook placeholder only.

Acceptance:

- Admin can define reusable groups and attach them to products/categories.
- Existing QR ordering still validates the rendered product-attached options.

### M3.3 - Branch Overrides And Effective Menu

Scope:

- Add branch category/product overrides.
- Add branch variant price overrides.
- Add branch option value overrides.
- Build effective-menu resolver.
- Add admin branch menu override UI.

Acceptance:

- Branch A and Branch B can show different availability/prices for the same shared catalog item.
- POS sync can pull effective branch menu tables.

### M3.4 - Tax Overrides And KDS Routing

Scope:

- Add branch category/product tax overrides.
- Add branch category/product print routing.
- Integrate with Module 2 tax/printer settings.
- Keep legacy `category_print_routes` untouched.

Acceptance:

- Effective tax resolution follows product -> category -> branch default.
- Effective routing follows product -> category -> legacy fallback -> all stations.

### M3.5 - Tags, Time Windows, And Bulk Import

Scope:

- Add allergen/dietary tags and product tag management.
- Add day-of-week and time-of-day availability windows.
- Add CSV/Excel import.

Acceptance:

- Admin can tag products, define timed availability, and import base catalog rows.
- Recipe-derived tag flow remains deferred to Module 4.

### M3.6 - Module 3 Closeout

Scope:

- Navigation polish.
- Full Quickarte compatibility sweep.
- SDK/RLS/test consolidation.
- Write `docs/phase-1/MODULE_3_COMPLETE.md`.

Acceptance:

- All Module 3 endpoints typed in SDK.
- All new tenant-scoped tables have strict RLS.
- Quickarte live menu/order/printing flows remain compatible.

## Decisions Surfaced For PM

1. Zod adoption: approve M3.0 to adopt `drizzle-zod` + `nestjs-zod` for new Module 3 endpoints, with fallback if OpenAPI/SDK quality is weak. Recommendation: approve.
2. Variant model: approve variant-first implementation where every sellable price is represented as a variant, branch price overrides target variants, and products without variants get a default/synthetic variant for compatibility. Recommendation: approve.
3. Modifier model: approve reusable modifier templates plus product-attached rendered instances, preserving existing `product_options` / `option_values` for Quickarte compatibility. Recommendation: approve.
4. Quantity-tiered modifier pricing: decide whether "N free, then +X each" is MVP. Recommendation: include in MVP if implementation remains localized to modifier validation/pricing, because reviewed menus show this pattern and deferring it causes Module 6 order-total rework.
5. Combo priority: decide whether configurable combos are MVP or v1.1. Recommendation: design tables now; implement after core catalog/modifiers if the first pilot has traditional dine-in menus, otherwise v1.1.
6. Variable/market/weight pricing: decide whether POS-entered variable price is MVP. Recommendation: include the flag and server validation in MVP; defer scale integration and advanced weight workflows.
7. Menu-content locales: decide whether supported menu-content locales should include Spanish (`es`) from the start for northern/tourist markets, given reviewed menus included ES/FR/EN and no written Darija. Recommendation: support flexible locales technically and seed `fr`, `ar`, `en`, and `es`; keep Darija available as a custom locale only if a restaurant asks for it.
8. Branch override granularity: approve separate override tables for category visibility/order, product availability/86/channel flags, variant price overrides, tax overrides, and print routes. Recommendation: approve.
9. POS sync shape: approve derived branch-effective menu tables for POS sync rather than making the terminal recompute override precedence from raw tables. Recommendation: approve.
10. Public QR API shape: approve `GET /v1/public/menu?businessSlug=&branchSlug=&channel=qr` as the future Module 13 QR-facing effective-menu endpoint. Recommendation: approve, with exact URL naming finalized in Module 13.
11. Time-based menus priority: confirm day-of-week/time windows are designed now but implemented after base catalog/branch overrides unless PM prioritizes them earlier. Recommendation: implement in M3.5.

## Anti-Goals For Module 3 Implementation

- Do not add recipe, ingredient, or stock deduction logic. Module 4 owns that.
- Do not add `branch_id` directly to `categories`, `products`, `product_variants`, `product_options`, or `option_values`.
- Do not enable RLS on Quickarte-shared catalog tables until Quickarte uses API/`withTenant()` access paths.
- Do not rewrite Quickarte's existing QR storefront or print pipeline in M3.1.
- Do not expose money as JavaScript numbers in new API contracts.
- Do not implement POS order-taking screens; Module 6 owns POS order flow.
- Do not implement real KDS screens; Module 7 owns KDS.
