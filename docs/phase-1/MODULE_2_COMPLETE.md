# Module 2 Complete - Restaurant Setup & Configuration

Status: complete for the Module 2 foundation scope.

This closeout covers implementation milestones M2.1 through M2.6. Module 2 created the branch-aware restaurant setup foundation that later modules will reuse for menu, stock, POS, orders, reporting, receipt generation, and hardware routing.

## Spec Mapping

| Spec section | Status | What is built | Notes |
|---|---|---|---|
| 2.1 Restaurant profile | Done | `GET/PATCH /v1/businesses/me/setup`, `business_legal_profiles`, `businesses.secondary_currency`, admin Restaurant Profile page | `businesses.name` remains the trade/display name. `legal_name` lives in `business_legal_profiles`. Legal address fields are present but optional until DGI work. |
| 2.2 Branch management | Done | `branches`, default branch backfill, branch CRUD/default/soft-delete API, admin Branches page | Option A is implemented: `business_id` is the tenant key and `branch_id` is an operational filter/authorization dimension. |
| 2.3 Operating hours | Done | `branch_operating_hours`, `branch_schedule_settings`, `branch_closed_days`, normal/Ramadan schedules, closed days, admin Operating Hours page | Supports split shifts through `position`. |
| 2.4 Tax configuration | Partial | `tax_rates`, `branch_tax_settings`, branch default tax, TTC/HT display, service charge, admin Tax Configuration page | Category/product tax overrides are deferred to Module 3 because categories/products are not branch-aware yet. |
| 2.5 Receipt customization | Partial | `branch_receipt_settings`, admin Receipt Settings page, preview endpoint for sample receipts | Real order receipt generation consuming these settings is deferred to Module 8. |
| 2.6 Printer setup wizard | Partial | Existing `printers` extended with branch metadata, `printer_assignments`, admin Printer Setup page, test print queueing through existing `print_jobs` pipeline | Manual add/edit is implemented. Network discovery, USB discovery, and Bluetooth printing are deferred. |
| 2.7 Payment methods configuration | Done | `payment_method_definitions`, `branch_payment_methods`, admin Payment Methods page | CMI is config-only. Processing starts in Module 8. |

## Tables Created Or Extended

| Table | Created/extended | Scope | RLS | Notes |
|---|---|---|---|---|
| `branches` | Created | Tenant + branch | Strict RLS | One default active branch per business. |
| `business_legal_profiles` | Created | Tenant | Strict RLS | One-to-one legal profile for a business. |
| `businesses` | Extended | Tenant | Deferred | Added `secondary_currency`; Quickarte-shared table, no RLS change in Module 2. |
| `branch_operating_hours` | Created | Tenant + branch | Strict RLS | Normal and Ramadan schedules. |
| `branch_schedule_settings` | Created | Tenant + branch | Strict RLS | Ramadan-mode toggle. |
| `branch_closed_days` | Created | Tenant + branch | Strict RLS | Per-date closures. |
| `payment_method_definitions` | Created | Global lookup | None | Built-in Moroccan payment method definitions. |
| `branch_payment_methods` | Created | Tenant + branch | Strict RLS | Branch enablement and custom methods. |
| `tax_rates` | Created | Global lookup | None | Moroccan TVA lookup rates. |
| `branch_tax_settings` | Created | Tenant + branch | Strict RLS | Branch default tax and service charge. |
| `branch_receipt_settings` | Created | Tenant + branch | Strict RLS | Branch receipt layout/settings. |
| `printers` | Extended | Tenant + optional branch | Deferred | Added `branch_id`, `model`, `notes`, `last_test_print_at`; Quickarte-shared table, explicit API filtering by `business_id`. |
| `printer_assignments` | Created | Tenant + branch | Strict RLS | Branch-level receipt/kitchen/bar/customer-copy roles and fallbacks. |

## API Surface Completed

All Module 2 endpoints are under `/v1`, use typed request/response DTOs, are included in OpenAPI, and are represented in `packages/shared-types`.

Business setup:
- `GET /v1/businesses/me/setup`
- `PATCH /v1/businesses/me/setup`

Branches:
- `GET /v1/branches`
- `POST /v1/branches`
- `GET /v1/branches/{branchId}`
- `PATCH /v1/branches/{branchId}`
- `POST /v1/branches/{branchId}/set-default`
- `DELETE /v1/branches/{branchId}`

Operating hours:
- `GET /v1/branches/{branchId}/operating-hours`
- `PUT /v1/branches/{branchId}/operating-hours`

Payment methods:
- `GET /v1/payment-method-definitions`
- `GET /v1/branches/{branchId}/payment-methods`
- `PUT /v1/branches/{branchId}/payment-methods`

Tax:
- `GET /v1/tax-rates`
- `GET /v1/branches/{branchId}/tax-config`
- `PUT /v1/branches/{branchId}/tax-config`

Receipts:
- `GET /v1/branches/{branchId}/receipt-settings`
- `PUT /v1/branches/{branchId}/receipt-settings`
- `POST /v1/branches/{branchId}/receipt-settings/preview`

Printers:
- `GET /v1/branches/{branchId}/printers`
- `POST /v1/branches/{branchId}/printers`
- `PATCH /v1/branches/{branchId}/printers/{printerId}`
- `DELETE /v1/branches/{branchId}/printers/{printerId}`
- `POST /v1/branches/{branchId}/printers/{printerId}/test-print`
- `PUT /v1/branches/{branchId}/printer-assignments`

## Admin Web

The admin web app now has seven Module 2 settings pages:

- Restaurant Profile
- Branches
- Operating Hours
- Payment Methods
- Tax Configuration
- Receipt Settings
- Printer Setup

M2.6 consolidates these pages under a single Settings / Parametres nav section. The top-level feature placeholders remain separate: Dashboard, Menu, Orders, Reports, and Staff. The `/settings` route redirects to `/settings/profile`, so there is no orphaned settings landing page.

All pages use the shared SDK types, Mizan CSS tokens, and i18n keys from `packages/i18n`.

## Quickarte Compatibility Trace

Quickarte remains the live QR/order/loyalty app in this repo. Module 2 changed or extended shared schema carefully to avoid breaking it.

Business compatibility:
- `businesses.secondary_currency` is nullable and additive.
- Existing Quickarte business queries continue reading the same fields they read before Module 2.
- `businesses.name` remains the trade/display name.
- Legal fields are not moved out of existing Quickarte paths; the new legal profile is additive.

Branch compatibility:
- Existing businesses are backfilled with exactly one default branch in migration `0024_branch_foundation.sql`.
- Quickarte does not read `branches` yet, so branch-scoped Module 2 data does not affect existing QR/order flows.
- Legacy operational tables are not given `branch_id` until their owning modules refactor them.

Printer compatibility:
- `printers.branch_id`, `model`, `notes`, and `last_test_print_at` are nullable/additive.
- Existing printers are backfilled to the default branch where possible.
- `printers` remains without RLS because it is a Quickarte-shared table.
- New API printer queries explicitly filter by `business_id` and `branch_id`; Quickarte's existing printer queries continue to use their existing business-level assumptions.
- `bluetooth` was added to the connection type enum but no Bluetooth printing/discovery was implemented. Existing connection types remain unchanged.
- Test print in the Nest API reuses the existing `print_jobs` queue mechanism that the webprint/kiosk agent already polls.

Verification:
- Quickarte test suite remains green at 338 passing, 8 skipped, 0 failing.
- Existing Quickarte print tests remain green, including ticket formatting, routing, pipeline, and kiosk tests.

## RLS Verification

Strict RLS is enabled for all new tenant-scoped Module 2 tables:

- `branches`
- `business_legal_profiles`
- `branch_operating_hours`
- `branch_schedule_settings`
- `branch_closed_days`
- `branch_payment_methods`
- `branch_tax_settings`
- `branch_receipt_settings`
- `printer_assignments`

Global lookup tables intentionally have no RLS:

- `payment_method_definitions`
- `tax_rates`

Quickarte-shared tables intentionally remain on the RLS rollout plan:

- `businesses`
- `printers`
- legacy order/menu/print-route tables

The API integration suite includes non-superuser `quickarte_rls_test` coverage for Module 2 RLS tables and explicit isolation coverage for shared `printers` queries.

## SDK Verification

The SDK is regenerated from OpenAPI after Module 2. It includes typed paths for:

- business setup
- branches
- operating hours
- payment method definitions
- branch payment methods
- tax rates
- branch tax config
- receipt settings
- receipt preview
- printers
- printer assignments
- printer test print

The M2.6 verification command `pnpm.cmd sdk:generate; git diff --exit-code packages/shared-types/src/api.ts packages/shared-types/openapi.json` must stay clean before merge.

## Deferred Items

| Deferred item | Target | Reason |
|---|---|---|
| `category_tax_overrides` / `product_tax_overrides` | Module 3 | Requires branch-aware categories/products. |
| Real order-receipt generation consuming `branch_receipt_settings` | Module 8 | Requires real order/payment receipt pipeline. |
| Bluetooth printing | POS terminal app | Bluetooth is device-local and belongs in the terminal runtime. |
| Network/USB printer auto-discovery | Later printer hardening | Manual add is enough for Module 2; USB discovery is terminal-local. |
| `printers.station` vs `printer_assignments` reconciliation | Module 6 / Module 8 | Existing Quickarte pipeline still uses `station`; new branch assignment model is additive. |
| `staff_branch_assignments` | Module 11 | PM decision locked staff branch assignment out of Module 2. |
| RLS on Quickarte-shared tables | Owning feature modules | Requires Quickarte DB access refactor to use `withTenant()` safely. |

## Module 3 Handoff

Module 3 should start with one explicit design decision: shared catalog vs per-branch menu.

Option A: shared catalog with branch-level availability/pricing.
- One business-level product/category catalog.
- Branch-specific availability, stock linkage, price overrides, and tax overrides live in branch join tables.
- Better for multi-branch consistency and central management.
- Requires careful override logic in POS/admin UI.

Option B: fully independent per-branch menus.
- Categories/products belong directly to a branch.
- Simpler local POS behavior.
- Harder cross-branch menu management and reporting.
- More duplication for owners running several similar branches.

Recommendation for Module 3 design: use a shared business catalog with branch-level availability/pricing/tax overrides unless PM explicitly wants fully independent branch menus. This fits the business-as-tenant model and keeps later multi-branch central control viable.

Module 3 must also decide:
- How categories and products become branch-aware without breaking Quickarte's existing QR menu assumptions.
- Whether `branch_id` is added directly to menu tables or represented through branch availability/override tables.
- How category/product tax overrides hook into `branch_tax_settings.default_tax_rate_id`.
- How category-to-printer routing becomes branch-aware without breaking existing `category_print_routes`.
- How menu data enters POS sync tables in the offline-first model.

## Closeout Verdict

Module 2 is ready for PM review and, after merge, Module 3 design. No new feature-module work should begin until the Module 3 data model/API design is approved.
