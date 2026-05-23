# Module 3 Complete - Menu Management

Status: complete for the Module 3 foundation scope.

Module 3 implemented the shared business-level menu catalog approved in the design milestone, with branch-level overrides for availability, pricing, tax, and routing. The existing Quickarte QR menu tables remain shared production tables with explicit `business_id` filtering; new tenant-owned Module 3 tables ship with strict RLS.

## Spec Mapping

| Spec section | Status | What is built | Deferred / notes |
|---|---|---|---|
| 3.1 Categories and subcategories | Done | Existing `categories` extended with slug, one-level parent category, localized names/descriptions, color tag, soft delete, reorder, admin catalog rail | Quickarte continues to read `categories.name`, `position`, and `visible` as before. |
| 3.2 Products and variants | Done | Existing `products` extended with SKU/item code, localized names/descriptions, color tag, featured/hidden, channel flags, soft delete, spice level; `product_variants` extended with kind, pricing mode, display range/unit metadata; admin variant-first editor | Variable-price items are configuration-only until POS order entry in Module 6. Imported variant products keep `products.price` equal to the first variant price for Quickarte fallback compatibility. |
| 3.3 Modifier groups and options | Done | Reusable `modifier_group_templates`, `modifier_value_templates`, product materialization into existing `product_options` / `option_values`, category-wide attachments, quantity-tiered pricing helper | QR over-quota tiered modifier pricing is advisory-only until Module 13 moves QR ordering to the API. |
| 3.4 Allergen and dietary tags | Done | `dietary_tags`, `product_tags`, system/custom tag management, product tag assignment, tags in effective menu | Auto-tagging from recipe ingredients is Module 4. |
| 3.5 Availability windows | Done | `product_availability_windows`, day-of-week windows, cross-midnight support, branch-timezone-aware `availableNow` in effective menu | Windows are product/business-level only; branch availability continues to use branch overrides and 86 status. |
| 3.6 Branch effective menu | Done | Branch category/product overrides, per-variant price overrides, branch option-value overrides, effective-menu resolver, admin branch override panel | POS sync wiring for the resolved menu is deferred to Module 6. |
| 3.7 Bulk import | Done | Two-phase `.xlsx` / `.csv` import: upload preview, persisted `menu_import_jobs`, template download, atomic commit, idempotent-ish matching, tag/tax validation, comma-decimal normalization | Modifier, recipe, image, availability-window, and branch-override import are deferred. Import-job retention sweep is future ops work. |

## Tables Created Or Extended

| Table | Created/extended | Scope | RLS | Notes |
|---|---|---|---|---|
| `categories` | Extended | Quickarte-shared | Deferred | Added parent, slug, localized fields, color tag, soft delete. API uses explicit `business_id` filters. |
| `products` | Extended | Quickarte-shared | Deferred | Added SKU/item code, localized fields, channel flags, spice level, soft delete. API uses explicit `business_id` filters. |
| `product_variants` | Extended | Quickarte-shared | Deferred | Added variant kind, pricing mode, display/market price metadata. |
| `product_options` | Extended | Quickarte-shared | Deferred | Added template back-reference, localized names, tiered modifier fields. |
| `option_values` | Extended | Quickarte-shared | Deferred | Added template value back-reference and localized names. |
| `menu_locale_settings` | Created | Tenant | Strict RLS | Active menu locales and default content locale. |
| `product_images` | Created | Tenant | Strict RLS | Product image gallery with primary image fallback to `products.image`. |
| `modifier_group_templates` | Created | Tenant | Strict RLS | Reusable modifier group definitions. |
| `modifier_value_templates` | Created | Tenant | Strict RLS | Reusable modifier values with inert `recipe_hook_key` placeholder. |
| `category_modifier_groups` | Created | Tenant | Strict RLS | Category-wide modifier attachments. |
| `branch_category_overrides` | Created | Tenant + branch | Strict RLS | Branch category visibility/order overrides. |
| `branch_product_overrides` | Created | Tenant + branch | Strict RLS | Branch availability, 86 status, channel flags, featured/hidden overrides. |
| `branch_product_price_overrides` | Created | Tenant + branch | Strict RLS | Branch per-variant price overrides. |
| `branch_option_value_overrides` | Created | Tenant + branch | Strict RLS | Branch option-value availability and price overrides. |
| `branch_category_tax_overrides` | Created | Tenant + branch | Strict RLS | Branch category tax overrides. |
| `branch_product_tax_overrides` | Created | Tenant + branch | Strict RLS | Branch product tax overrides. |
| `branch_category_print_routes` | Created | Tenant + branch | Strict RLS | Branch category station routing. |
| `branch_product_print_routes` | Created | Tenant + branch | Strict RLS | Branch product station routing. |
| `dietary_tags` | Created | Tenant | Strict RLS | System and custom dietary/allergen tags. |
| `product_tags` | Created | Tenant | Strict RLS | Product-tag joins. |
| `product_availability_windows` | Created | Tenant | Strict RLS | Product time windows. |
| `menu_import_jobs` | Created | Tenant | Strict RLS | Stateful import preview/commit jobs. |

## API Surface Completed

All Module 3 endpoints are under `/v1`, use Zod DTOs via `createZodDto`, are included in OpenAPI, and are regenerated into `packages/shared-types`.

Catalog:
- `GET /v1/menu/categories`
- `POST /v1/menu/categories`
- `PATCH /v1/menu/categories/{categoryId}`
- `DELETE /v1/menu/categories/{categoryId}`
- `PUT /v1/menu/categories/reorder`
- `GET /v1/menu/products`
- `POST /v1/menu/products`
- `GET /v1/menu/products/{productId}`
- `PATCH /v1/menu/products/{productId}`
- `DELETE /v1/menu/products/{productId}`
- `PUT /v1/menu/products/reorder`
- `PUT /v1/menu/products/{productId}/variants`
- `PUT /v1/menu/products/{productId}/images`
- `GET /v1/menu/locale-settings`
- `PUT /v1/menu/locale-settings`

Modifiers:
- `GET /v1/menu/modifier-groups`
- `POST /v1/menu/modifier-groups`
- `PATCH /v1/menu/modifier-groups/{groupId}`
- `DELETE /v1/menu/modifier-groups/{groupId}`
- `POST /v1/menu/modifier-groups/{groupId}/reapply`
- `PUT /v1/menu/products/{productId}/modifier-groups`
- `PUT /v1/menu/categories/{categoryId}/modifier-groups`

Branch effective menu:
- `GET /v1/branches/{branchId}/menu/effective`
- `GET /v1/branches/{branchId}/menu-overrides`
- `PUT /v1/branches/{branchId}/menu-overrides`
- `PATCH /v1/branches/{branchId}/products/{productId}/availability`
- `PUT /v1/branches/{branchId}/products/{productId}/prices`
- `PUT /v1/branches/{branchId}/menu-tax-overrides`
- `PUT /v1/branches/{branchId}/menu-print-routes`

Tags and windows:
- `GET /v1/menu/tags`
- `POST /v1/menu/tags`
- `PATCH /v1/menu/tags/{tagId}`
- `DELETE /v1/menu/tags/{tagId}`
- `PUT /v1/menu/products/{productId}/tags`
- `PUT /v1/menu/products/{productId}/availability-windows`

Import:
- `POST /v1/menu/import`
- `GET /v1/menu/import/{jobId}`
- `POST /v1/menu/import/{jobId}/commit`
- `GET /v1/menu/import/template`

The M3.0 test-only `_samples` effective-menu endpoint was removed before closeout and is no longer present in OpenAPI or the generated SDK.

## Admin Web

The Menu area now groups the Module 3 screens in a coherent navigation section:

- Catalog editor
- Branch overrides
- Tags and availability windows
- Bulk import

The catalog screen covers shared categories/products, variant editing, modifier template attachment, category-inherited modifier badges, product tags, spice level, and availability windows. The branch override panel covers per-branch 86/channel/price overrides, tax overrides, and station routing. The import panel covers template download, file upload, preview, blocking errors, and commit.

The catalog modifier attach UI now warns when a QR-enabled product has a quantity-tiered modifier group attached, because legacy QR ordering does not yet charge over-quota tier pricing.

## Effective Menu Rules

The Module 3 resolver is the authoritative display resolver for branch menus. It does not submit or validate orders; Module 6 must re-resolve the menu server-side at order submission.

Resolution order:

- Price: branch variant override -> business variant `price_override` -> product base price.
- Availability: soft delete/global availability/global hidden/channel flags -> branch availability/hidden/channel flags -> branch 86 status.
- Tax: branch product tax override -> branch category tax override -> explicit branch default -> service fallback `ma_tva_10`.
- Routing: branch product routes -> branch category routes -> legacy `category_print_routes` -> all stations.
- Modifiers: product-attached groups plus category-inherited groups, with branch option-value availability/price overrides.
- Tags/windows: product tags and product windows are intrinsic business-level metadata; `availableNow` is computed server-side using the branch IANA timezone.

Money values are decimal strings on the wire. Tax rates and service-charge rates remain numeric percentages, per the Phase 1 conventions.

## Quickarte Compatibility Sweep

Quickarte remains the live QR storefront and QR ordering app.

Catalog compatibility:
- Existing QR catalog reads continue to use `categories`, `products`, `product_variants`, `product_options`, and `option_values`.
- All Module 3 changes to those shared tables are additive/nullable.
- API writes keep legacy fallback fields populated: `products.name`, `products.description`, `products.image`, and `products.price`.
- Imported variant products set `products.price` from the first imported variant so legacy QR views still have a base price.
- Products without real variant rows still work through the existing QR fallback path; the API-only synthetic default variant is never written as a phantom row.

Modifier compatibility:
- Reusable modifier templates materialize into existing `product_options` and `option_values`, so current QR order validation reads the same tables as before.
- Re-applying a modifier template updates surviving materialized `option_values` in place by `template_value_id`, preserving IDs so branch option-value overrides are not orphaned.
- Tiered over-quota pricing is not wired into Quickarte QR order totals; the admin warning documents that gap until Module 13.

Order and print compatibility:
- Existing QR order validation remains unchanged and passing.
- Legacy `category_print_routes` remains untouched and still participates as the fallback in effective routing.
- Station-to-printer mapping remains outside Module 3.

Verification:
- Full workspace test sweep remains green.
- QR compatibility coverage includes the existing QR catalog/order tests plus Module 3 explicit compatibility tests for variant fallback and shared-table filtering.

## RLS And Isolation

New Module 3 tenant-owned tables have strict RLS using the Phase 0 fail-closed policy pattern.

Quickarte-shared catalog tables intentionally remain without RLS until Quickarte is refactored to use API/`withTenant()` access paths. Every new API query against those tables uses explicit `business_id` filtering or an ownership join, and the integration tests include shared-table isolation coverage.

## Carry-Forward Register

| Item | Target | Reason |
|---|---|---|
| Combos | Deferred; gated on vertical/first-pilot profile | Combos are designed but not implemented. They are common in some Moroccan formats, but implementation priority depends on the first pilot's actual menu style. |
| QR over-quota tiered modifier pricing | Module 13 | Module 3 can configure tiered modifiers and Module 6 can price them server-side. Legacy QR ordering undercharges over-quota tiers until QR moves onto the API. |
| Separate `order.void` and `order.refund` permissions | Module 6 | `order.update` is granted to Cashier/Waiter for fast 86. Void/refund must be separate, narrower permissions. |
| Arabic translation pass | Before GA | AR keys are reserved in many screens, but the full Arabic copy pass remains owed before general availability. |
| Station vocabulary reconciliation | Module 9 | Module 3 keeps station strings flexible. KDS/printing must reconcile `bar`, `counter`, `kitchen`, and any future station names. |
| Import-job retention sweep | Later ops hardening | `menu_import_jobs` stores preview JSON. Add retention/cleanup once import usage patterns are known. |
| `products.price` fallback for variant products | Compatibility debt | Imported multi-variant products set `products.price` to the first variant price for Quickarte fallback reads. Long term, all clients should use variants. |
| POS sync of effective menu | Module 6 | Module 3 exposes effective menu via API; POS offline sync wiring comes with order-taking. |
| Public QR effective menu API | Module 13 | Existing QR storefront remains on Quickarte reads until its migration milestone. |
| Modifier import | Later menu ops | Bulk import intentionally excludes modifiers to keep M3.5b safe. |
| Availability-window import | Later menu ops | Windows can be edited in admin; import support can follow after usage is validated. |

## Module 4 Handoff

Module 4 should build recipes and stock against the Module 3 catalog model:

- Recipes attach per variant, not just per product, because variants are the sellable price/unit boundary.
- Modifier value recipe deltas should wire into the inert `modifier_value_templates.recipe_hook_key` placeholder introduced in Module 3.
- Dietary/allergen auto-tagging should flow from recipe ingredients into `dietary_tags` / `product_tags`, without replacing manual tags.
- Stock availability can later feed branch availability/86 decisions, but Module 3's manual branch override model remains the user-facing control surface.

## Closeout Verdict

Module 3 is ready for PM review and, after merge, Module 4 design. No Module 4 recipe/stock implementation should begin until the Module 4 data model and API surface are approved.
