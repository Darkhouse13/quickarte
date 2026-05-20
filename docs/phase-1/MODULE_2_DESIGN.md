# Module 2 Design - Restaurant Setup & Configuration

Status: Design proposal for PM review. No migrations or implementation are included in this milestone.

Branch: `module-2-design`

## References Read

- `docs/phase-0/MVP_Feature_Spec_v1.md`, Module 2 sections 2.1 through 2.7.
- `docs/phase-0/SPEC_AMENDMENTS.md`.
- `docs/phase-0/RLS_ROLLOUT_PLAN.md`.
- `docs/phase-0/ARCHITECTURE.md`.
- `packages/db-schema/src/schema/business.ts`.
- `packages/db-schema/src/schema/catalog.ts`.
- `packages/db-schema/src/schema/ordering.ts`.
- `packages/db-schema/src/schema/identity.ts`.
- `packages/db-schema/src/schema/auth.ts`.
- Existing migrations:
  - `packages/db-schema/migrations/0000_broad_spiral.sql`
  - `packages/db-schema/migrations/0008_morocco_default_business_columns.sql`
  - `packages/db-schema/migrations/0013_operational_settings_table_qrs.sql`
  - `packages/db-schema/migrations/0014_staff_roles_order_events_printers.sql`
  - `packages/db-schema/migrations/0015_printer_tokens_and_print_pipeline.sql`
  - `packages/db-schema/migrations/0019_print_station_routing.sql`
- Quickarte printing abstraction:
  - `apps/qr-menu/lib/printing/printers.ts`
  - `apps/qr-menu/lib/printing/routing.ts`
  - `apps/qr-menu/lib/printing/pipeline.ts`
  - `apps/qr-menu/lib/printing/job-builder.ts`
  - `apps/qr-menu/lib/printing/ticket.ts`
  - `apps/qr-menu/lib/printing/actions.ts`
  - `apps/qr-menu/lib/printing/kiosk.ts`

## Locked Decisions Applied

- Tenant key remains `business_id`, not `restaurant_id`.
- `business_id` is the RLS tenant key. Branches are tenant-scoped records, not tenants.
- Architecture stays cloud-agnostic. Hetzner Falkenstein + Coolify is the deployment target, but it does not affect this schema.
- Better Auth web sessions remain for Quickarte; the new API uses the JWT layer built in Phase 0.
- CMI/offline card payments are not implemented in Module 2. Payment method configuration must leave room for future CMI records, idempotency keys, audit logging, and offline sync.
- Admin-web screens built later must consume `docs/design/mizan-tokens.css`; this design milestone does not apply UI tokens.

## Current State

### `businesses` Table Today

Current definition lives in `packages/db-schema/src/schema/business.ts`.

| Column | Current purpose |
|---|---|
| `id` | Business primary key. This is the tenant key used as `business_id` by dependent tables. |
| `owner_id` | References `users.id`. Identifies the owning Quickarte user. |
| `name` | Public business display name used by Quickarte menus and UI. This currently acts like the trade name. |
| `slug` | Unique business slug. Used for QR/menu routing and later tenant subdomain routing. |
| `type` | `business_type` enum. Current schema values are `restaurant`, `cafe`, `autre` in TypeScript. The first migration used `restaurant`, `cafe`, `retail`; the current schema is authoritative for new work. |
| `city` | Optional city. Added after the initial table creation. |
| `address` | Optional plain-text address. Added after the initial table creation. |
| `google_place_id` | Optional Google Place ID. |
| `formatted_address` | Optional formatted address from Google Places. |
| `lat` | Optional latitude as `numeric(10,7)`. |
| `lng` | Optional longitude as `numeric(10,7)`. |
| `logo` | Optional logo URL/path. |
| `cover` | Optional cover image URL/path. |
| `currency` | Currency code. `0008_morocco_default_business_columns.sql` sets default to `MAD`. |
| `timezone` | Timezone. `0008_morocco_default_business_columns.sql` sets default to `Africa/Casablanca`. |
| `locale` | Locale. `0008_morocco_default_business_columns.sql` sets default to `fr-MA`. |
| `stripe_account_id` | Legacy Stripe account linkage. Stripe is abandoned for the new POS foundation and should not be expanded in Module 2. |
| `stripe_charges_enabled` | Legacy Stripe status flag. |
| `stripe_payouts_enabled` | Legacy Stripe status flag. |
| `stripe_onboarding_completed_at` | Legacy Stripe onboarding timestamp. |
| `created_at` | Row creation timestamp. |
| `updated_at` | Row update timestamp. |

Important finding: `0008_morocco_default_business_columns.sql` does not add ICE, RC, IF, Patente, or CNSS fields. It only sets Morocco-friendly defaults for `currency`, `timezone`, and `locale`.

### Current `business_settings` Shape

`business_settings` is a one-to-one business-level settings table. It is not branch-aware today.

Current columns:

- `id`
- `business_id`
- `menu_qr_enabled`
- `ordering_enabled`
- `loyalty_enabled`
- `analytics_enabled`
- `reservations_enabled`
- `dine_in_enabled`
- `takeaway_enabled`
- `delivery_enabled`
- `table_qr_count`
- `whatsapp_number`
- `customer_post_order_message`
- `pos_coexistence_enabled`
- `google_place_id`
- `created_at`
- `updated_at`

Module 2 should not duplicate this table. It should keep QR/order feature flags in `business_settings` and add branch-level operational configuration in new branch-scoped tables.

### Current Single-Location Assumption

Quickarte currently assumes one operational location per business:

- Menu/catalog tables are business-scoped: `categories.business_id`, `products.business_id`.
- Orders are business-scoped: `orders.business_id`; `order_items` inherit through `orders`.
- Staff are business-scoped: `staff_members.business_id`.
- Reservations are business-scoped: `reservations.business_id`.
- Printers are business-scoped: `printers.business_id`.
- Print routing is business-scoped: `category_print_routes.business_id`.
- Business address/logo/currency/timezone/locale sit directly on `businesses`.

There is no `branches` table and no `branch_id` column on operational tables today.

### Existing Tables That Become Branch-Scoped Under Multi-Branch

The final multi-branch model should branch-scope operational data. Existing tables affected over time:

| Existing table | Current scope | Future branch implication |
|---|---|---|
| `categories` | `business_id` | Menu categories should gain `branch_id` when Module 3/Menu is branch-aware. |
| `products` | `business_id` | Products should gain `branch_id` or be split into shared catalog + branch availability/pricing. PM decision needed in Module 3. |
| `orders` | `business_id` | POS/order records must gain `branch_id` before multi-branch POS launch. |
| `reservations` | `business_id` | Reservations should gain `branch_id`. |
| `staff_members` | `business_id` | Staff identity should stay business-scoped; branch membership should be represented by a join table. |
| `printers` | `business_id` | Printers are physically branch-scoped and should gain `branch_id`. |
| `category_print_routes` | `business_id` + `category_id` | Print routing must become branch-aware. |
| `print_jobs` | Indirect through printer/order | Jobs inherit branch via printer and/or order after those tables are branch-scoped. |
| `business_settings` | `business_id` | Keep business-wide QR/order feature flags here; do not make it the general branch settings table. |

### Fields That Move to Branch Level vs Stay at Business Level

| Spec field | Current location | Recommended final level |
|---|---|---|
| Legal name | Missing | Business legal profile |
| Trade name | `businesses.name` | Business level as brand/trade name; branch has its own display name |
| ICE, RC, IF, Patente, CNSS | Missing | Business legal profile |
| Address/postcode | `businesses.address`, `city`, `formatted_address`, `lat`, `lng` | Branch level for operating address; optional legal address in business legal profile if needed |
| Phone/email/website/social links | Mostly missing | Branch level, with possible business defaults later |
| Logo | `businesses.logo` | Business default; branch may override |
| Cuisine type | Partially `businesses.type` | Branch profile or business default. Recommend branch-level `cuisine_type` because locations can differ. |
| Seating capacity | Missing | Branch level |
| Currency | `businesses.currency` | Business default; branch override only if future multi-country expansion requires it |
| Secondary display currency | Missing | Business default |
| Timezone | `businesses.timezone` | Business default; branch override supported but default `Africa/Casablanca` |
| Default language | `businesses.locale` | Business default; branch override supported |
| Operating hours | Missing | Branch level |
| Tax configuration | Missing | Branch level, with global Moroccan TVA lookup |
| Receipt customization | Missing | Branch level, with business logo fallback |
| Printer setup | `printers`, `print_jobs`, `category_print_routes` | Branch level, extending existing printer pipeline |
| Payment methods | `orders.payment_mode` is not configuration | Branch level |

## Existing Schema to Extend

### 2.1 Restaurant Profile

Already exists:

- `businesses.name` for public display/trade name.
- `businesses.slug` for routing.
- `businesses.type` for broad business type.
- `businesses.city`, `address`, `google_place_id`, `formatted_address`, `lat`, `lng`.
- `businesses.logo`, `cover`.
- `businesses.currency`, default `MAD`.
- `businesses.timezone`, default `Africa/Casablanca`.
- `businesses.locale`, default `fr-MA`.

Genuinely new:

- Legal identifiers: legal name, ICE, RC, IF, Patente, CNSS.
- Moroccan postcode.
- Phone, email, website, social links.
- Seating capacity.
- Secondary display currency.
- Branch-specific profile overrides.

Overlap or PM decision:

- `businesses.name` should be treated as the trade/display name to avoid adding a duplicate `trade_name` column. If PM needs a separate invoice trade name and public menu name, add `trade_name` later.
- Current address fields on `businesses` should become legacy/default fields after branches exist. New operational addresses should live on `branches`.

### 2.2 Branches

Already exists:

- No `branches` table exists.
- Existing operational data is all business-scoped and therefore implicitly belongs to one location.

Genuinely new:

- `branches` table.
- Default branch creation for every existing business.
- Branch assignment model for operational tables over time.

Overlap or PM decision:

- Whether Module 2 implementation immediately adds nullable `branch_id` to all existing operational tables, or adds it module-by-module. Recommendation: create `branches` now, branch-scope Module 2 tables now, and add `branch_id` to legacy operational tables when each feature module is refactored.

### 2.3 Operating Hours

Already exists:

- No operating-hours table exists.
- No Ramadan mode schedule exists.
- No closed-day table exists.

Genuinely new:

- Branch operating hours.
- Ramadan alternate schedule.
- Branch closed days/special closures.

Overlap or PM decision:

- None significant. This should be branch-scoped from day one.

### 2.4 Tax Configuration

Already exists:

- No tax configuration table exists.
- `orders.total` stores totals but not tax breakdown.
- Products/categories do not have tax fields.
- `business_settings` has QR/order feature flags only.

Genuinely new:

- Global Moroccan TVA rate lookup.
- Branch tax settings.
- Category and item tax override model.
- Receipt tax display mode.
- Optional service charge configuration.

Overlap or PM decision:

- Do not put tax settings into `business_settings`; tax is branch operational configuration.
- Category/product tax overrides will touch Module 3 menu schema. Module 2 can define the contract, but implementation should coordinate with Module 3 to avoid reshaping menu twice.

### 2.5 Receipt Customization

Already exists:

- Printing ticket rendering exists in `apps/qr-menu/lib/printing/ticket.ts`.
- Existing ticket output is plain 32-column text and includes hardcoded Quickarte-era assumptions.
- No receipt settings table exists.

Genuinely new:

- Branch receipt settings.
- Header/footer lines.
- Show/hide toggles.
- Bilingual layout choice.
- 58mm/80mm paper width.
- QR code target configuration.

Overlap or PM decision:

- Receipt settings should feed the existing print pipeline rather than creating a second receipt renderer. The renderer can be extended later to consume settings.

### 2.6 Printer Setup

Already exists:

- `printers` table with `business_id`, `name`, `station`, `connection_type`, `address`, `webprint_token`, `last_seen_at`, `enabled`, `deleted_at`, timestamps.
- `print_jobs` table with nullable `order_id`, `printer_id`, `status`, attempts, last error, payload text, timestamps.
- `category_print_routes` table keyed by `business_id`, `category_id`, `station`.
- Quickarte abstraction supports `manual`, `escpos_lan`, `escpos_usb`, and `webprint`.
- `getOrCreateDefaultCounterPrinter()` creates a default manual counter printer per business.
- Routing defaults categories to all stations if no explicit route exists; counter is always included.

Genuinely new:

- Branch-aware printers.
- Printer roles/assignments for receipts, kitchen, bar, and customer copy.
- Test-print command as an API operation.
- Printer fallback chain.
- Bluetooth support decision if required by hardware scope.

Overlap or PM decision:

- Existing `printers.station` is too narrow for the full Module 2 assignment model. Recommendation: keep it for compatibility during migration, add `branch_id`, and introduce `printer_assignments` for future roles/fallbacks.
- Bluetooth is in the spec text, but Phase 0 locked hardware baseline emphasized ESC/POS LAN, USB, and webprint. PM should decide whether Bluetooth is MVP or deferred.

### 2.7 Payment Methods

Already exists:

- `orders.payment_mode` enum has `mad` and `credits`, which is not a branch payment-method configuration model.
- Stripe columns remain on `businesses`, but Stripe is abandoned for new POS work.
- No CMI table exists.

Genuinely new:

- Branch payment method configuration.
- Built-in method codes: cash, cmi_card, inwi_money, orange_money, marocpay, voucher, comp, other.
- Custom payment methods.
- Cash-drawer auto-open flag.

Overlap or PM decision:

- CMI is config-only in Module 2. No CMI processing or offline card implementation should be added before Module 8.

## Branch Model Decision

### Recommendation

Choose Option A: introduce a first-class `branches` table. Keep `business_id` as the tenant key. Branches are children of a business, and operational entities become branch-scoped while still carrying `business_id` for RLS.

This is the only option that supports the Module 2 Must-have requirement without a later rewrite.

### Option A - First-Class Branches

Relationship:

```text
businesses 1 -> many branches
branches.business_id -> businesses.id
operational tables: business_id + branch_id
RLS tenant key: business_id
```

Single-location restaurants get one auto-created default branch. Existing Quickarte data is treated as belonging to that default branch during migration.

Benefits:

- Matches the spec: one owner can manage multiple branches.
- Avoids making each branch a separate tenant, which would break cross-branch owner management.
- Keeps RLS simple: every tenant-scoped table still filters by `business_id`.
- Lets reports query by branch or aggregate within the same tenant.
- Makes future stock, POS, KDS, staff schedules, printers, payment methods, and receipts correctly branch-aware.

Costs:

- Existing business-scoped tables need phased branch migration.
- Quickarte production behavior must be preserved while branch columns are introduced.
- UI and API calls must always carry active branch context once feature modules begin.

Migration risk:

- Medium. Adding `branches` itself is low risk. Adding `branch_id` to existing operational tables is higher risk because Quickarte currently queries by `business_id` only.
- To reduce risk, create default branches first, branch-scope new Module 2 tables immediately, then migrate legacy operational tables module-by-module when their screens/APIs are refactored.

### Option B - Defer Multi-Branch

Treat every business as a single location for MVP and retrofit branches later.

Benefits:

- Faster initial implementation.
- Lower immediate migration risk.

Costs:

- Violates Module 2.2 Must-have.
- Forces a painful rewrite of menu, stock, orders, staff, printers, reports, and sync later.
- Creates API contracts that would need breaking changes when `branch_id` is introduced.
- Risks customer data migration complexity after pilot restaurants are live.

Recommendation: reject.

### Option C - Business Per Branch With Parent Organization

Represent each branch as a separate `businesses` tenant and add a parent owner/org grouping later.

Benefits:

- Reuses current single-location assumption.
- Fewer table changes in the short term.

Costs:

- Breaks the locked business-as-tenant model.
- Makes cross-branch management harder because RLS isolates each branch as a tenant.
- Duplicates legal/tax/payment configuration across branch-tenants.
- Complicates POS sync and owner permissions.

Recommendation: reject.

### Business-Level vs Branch-Level Field Mapping

| Module 2.1 field | Recommended storage |
|---|---|
| Legal name | Business legal profile |
| Trade name | `businesses.name` as the business brand/trade name |
| ICE number | Business legal profile |
| RC number | Business legal profile |
| IF | Business legal profile |
| Patente | Business legal profile |
| CNSS number | Business legal profile |
| Address | Branch profile for operating address; legal address only if PM approves separate legal address fields |
| Moroccan postcode | Branch profile |
| Phone | Branch profile |
| Email | Branch profile |
| Website | Branch profile |
| Social links | Branch profile JSON |
| Logo | Business default via `businesses.logo`; branch override allowed |
| Cuisine type | Branch profile, defaulting from `businesses.type` |
| Seating capacity | Branch profile |
| Currency | Business default via `businesses.currency`; branch override optional but not required for Morocco MVP |
| Secondary display currency | Business profile/default setting |
| Timezone | Business default via `businesses.timezone`; branch override allowed |
| Default language | Business default via `businesses.locale`; branch override allowed |

### RLS Implication

- Every new tenant-scoped table must include `business_id`.
- Every new tenant-scoped table created from Module 2 onward must ship with strict RLS enabled in the same migration.
- Branch-scoped tables include both `business_id` and `branch_id`.
- Policies continue to check `business_id = current_setting('app.current_business_id', true)::uuid`.
- Application code must still query through `withTenant()`.
- `branch_id` is an authorization and filtering dimension, not the tenant key.

### Migration Path For Existing Quickarte Data

1. Create `branches`.
2. For each existing business, create one default branch using current business fields:
   - `branches.name = businesses.name`
   - `branches.slug = 'main'` or a normalized branch slug
   - address fields copied from `businesses.city`, `address`, `formatted_address`, `google_place_id`, `lat`, `lng`
   - logo inherited from `businesses.logo`
   - currency/timezone/locale default from `businesses`
3. New Module 2 tables are created branch-scoped from day one.
4. Existing Quickarte tables keep working during the transition.
5. Feature modules add/backfill `branch_id` to their owned operational tables when those modules are rebuilt.
6. Once Quickarte/shared paths use branch-aware APIs, enforce `branch_id NOT NULL` where appropriate.

## Full Module 2 Schema Proposal

This section is schema design only. It is not a migration.

### Shared Conventions

- Every tenant-scoped table includes `business_id uuid not null`.
- Every branch-scoped table includes `branch_id uuid not null`.
- New tenant-scoped tables enable RLS immediately.
- Use `created_at` and `updated_at` on mutable configuration tables.
- Avoid deleting configuration rows with history implications; prefer `deleted_at` or `enabled`.
- Use `jsonb` only where the structure is intentionally flexible, such as social links and receipt lines.

### 2.1 Restaurant Profile

#### Existing `businesses` table

Keep and extend carefully:

- Keep `businesses.name` as the trade/display brand name.
- Keep `businesses.slug` as the tenant slug.
- Keep `businesses.logo` as the business default logo.
- Keep `businesses.currency`, `timezone`, and `locale` as business defaults.
- Do not use legacy Stripe fields for Module 2 payment configuration.

Optional additions to `businesses`:

```ts
secondary_currency text null
```

Tenant-scoped: yes. Branch-scoped: no.

#### New `business_legal_profiles`

One row per business. This avoids duplicating trade/display fields already on `businesses`.

```ts
business_legal_profiles {
  business_id uuid primary key references businesses(id) on delete cascade
  legal_name text not null
  ice_number varchar(32) null
  rc_number varchar(32) null
  if_number varchar(32) null
  patente_number varchar(32) null
  cnss_number varchar(32) null
  legal_address text null
  legal_city text null
  legal_postcode varchar(16) null
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
}
```

Constraints:

- `ice_number`, `rc_number`, `if_number`, `patente_number`, and `cnss_number` should be normalized strings. Do not force numeric types because Moroccan identifiers may include leading zeroes or separators.
- Validate Moroccan postcode format at API layer first; add DB check only if format is fully confirmed.

Tenant-scoped: yes. Branch-scoped: no.

### 2.2 Branches

#### New `branches`

```ts
branches {
  id uuid primary key default gen_random_uuid()
  business_id uuid not null references businesses(id) on delete cascade
  name text not null
  slug varchar(80) not null
  is_default boolean not null default false
  status varchar(24) not null default 'active' // active, inactive
  address_line1 text null
  address_line2 text null
  city text null
  postcode varchar(16) null
  country_code char(2) not null default 'MA'
  google_place_id text null
  formatted_address text null
  lat numeric(10,7) null
  lng numeric(10,7) null
  phone text null
  email text null
  website text null
  social_links jsonb null
  logo text null
  cuisine_type text null
  seating_capacity integer null
  currency text null
  timezone text null
  locale text null
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
  deleted_at timestamptz null
}
```

Constraints:

- Unique `(business_id, slug)`.
- At most one default branch per business, via partial unique index on `(business_id)` where `is_default = true and deleted_at is null`.
- `seating_capacity >= 0`.
- `country_code = 'MA'` for MVP unless PM approves multi-country support.
- `currency`, `timezone`, and `locale` may be null to inherit business defaults.

Tenant-scoped: yes. Branch-scoped: this is the branch root.

#### New `staff_branch_assignments`

Staff should remain business-level identities because one employee may work multiple branches.

```ts
staff_branch_assignments {
  business_id uuid not null
  branch_id uuid not null references branches(id) on delete cascade
  staff_member_id uuid not null references staff_members(id) on delete cascade
  is_primary boolean not null default false
  created_at timestamptz not null default now()
  primary key (branch_id, staff_member_id)
}
```

Constraints:

- Unique primary branch per `(business_id, staff_member_id)` where `is_primary = true`.

Tenant-scoped: yes. Branch-scoped: yes.

### 2.3 Operating Hours

#### New enum-like values

Use a constrained varchar or enum:

- `normal`
- `ramadan`

#### New `branch_operating_hours`

Store intervals by day and schedule type. Multiple intervals per day support split shifts.

```ts
branch_operating_hours {
  id uuid primary key default gen_random_uuid()
  business_id uuid not null
  branch_id uuid not null references branches(id) on delete cascade
  schedule_type varchar(16) not null default 'normal'
  day_of_week smallint not null // 0 Sunday through 6 Saturday
  opens_at time null
  closes_at time null
  is_closed boolean not null default false
  position integer not null default 0
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
}
```

Constraints:

- `day_of_week between 0 and 6`.
- If `is_closed = true`, `opens_at` and `closes_at` must be null.
- If `is_closed = false`, `opens_at` and `closes_at` must be present.
- Unique `(branch_id, schedule_type, day_of_week, position)`.

Tenant-scoped: yes. Branch-scoped: yes.

#### New `branch_schedule_settings`

```ts
branch_schedule_settings {
  branch_id uuid primary key references branches(id) on delete cascade
  business_id uuid not null
  ramadan_mode_enabled boolean not null default false
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
}
```

Tenant-scoped: yes. Branch-scoped: yes.

#### New `branch_closed_days`

```ts
branch_closed_days {
  id uuid primary key default gen_random_uuid()
  business_id uuid not null
  branch_id uuid not null references branches(id) on delete cascade
  date date not null
  reason text null
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
}
```

Constraints:

- Unique `(branch_id, date)`.

Tenant-scoped: yes. Branch-scoped: yes.

### 2.4 Tax Configuration

#### New `tax_rates`

Global lookup table seeded once.

```ts
tax_rates {
  id varchar(32) primary key // ma_tva_20, ma_tva_14, ma_tva_10, ma_tva_7, ma_tva_0
  country_code char(2) not null default 'MA'
  label text not null
  rate numeric(5,2) not null
  is_active boolean not null default true
}
```

Seed values:

- 20.00
- 14.00
- 10.00 default restaurant food
- 7.00
- 0.00

Tenant-scoped: no. Branch-scoped: no.

#### New `branch_tax_settings`

```ts
branch_tax_settings {
  branch_id uuid primary key references branches(id) on delete cascade
  business_id uuid not null
  default_tax_rate_id varchar(32) not null references tax_rates(id)
  tax_application_level varchar(16) not null default 'category' // item, category
  price_display_mode varchar(16) not null default 'ttc' // ttc, ht_plus_tva
  service_charge_enabled boolean not null default false
  service_charge_rate numeric(5,2) null
  service_charge_label text null
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
}
```

Constraints:

- `service_charge_rate >= 0 and service_charge_rate <= 100`.
- If `service_charge_enabled = true`, `service_charge_rate` must be present.

Tenant-scoped: yes. Branch-scoped: yes.

#### Future `category_tax_overrides`

This belongs near Module 3 because categories are menu-owned, but Module 2 should define the intended shape.

```ts
category_tax_overrides {
  business_id uuid not null
  branch_id uuid not null references branches(id) on delete cascade
  category_id uuid not null references categories(id) on delete cascade
  tax_rate_id varchar(32) not null references tax_rates(id)
  primary key (branch_id, category_id)
}
```

Tenant-scoped: yes. Branch-scoped: yes.

#### Future `product_tax_overrides`

```ts
product_tax_overrides {
  business_id uuid not null
  branch_id uuid not null references branches(id) on delete cascade
  product_id uuid not null references products(id) on delete cascade
  tax_rate_id varchar(32) not null references tax_rates(id)
  primary key (branch_id, product_id)
}
```

Tenant-scoped: yes. Branch-scoped: yes.

### 2.5 Receipt Customization

#### New `branch_receipt_settings`

```ts
branch_receipt_settings {
  branch_id uuid primary key references branches(id) on delete cascade
  business_id uuid not null
  logo_url text null
  header_lines jsonb not null default '[]'
  footer_lines jsonb not null default '[]'
  show_item_codes boolean not null default false
  show_tax_breakdown boolean not null default true
  show_server_name boolean not null default true
  show_table_number boolean not null default true
  bilingual_mode varchar(24) not null default 'fr_only' // fr_only, ar_only, stacked, side_by_side
  paper_width varchar(8) not null default '80mm' // 58mm, 80mm
  qr_code_mode varchar(24) not null default 'none' // none, fidelity_signup, social_link, custom_url
  qr_code_url text null
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
}
```

Notes:

- `header_lines` and `footer_lines` should be arrays of `{ locale, text }`.
- Receipt text must remain externalized in i18n where it is app UI text. Merchant-provided receipt lines are data, not translation keys.
- Existing `apps/qr-menu/lib/printing/ticket.ts` should later consume this table instead of introducing a parallel renderer.

Tenant-scoped: yes. Branch-scoped: yes.

### 2.6 Printer Setup

#### Extend existing `printers`

Recommended additions:

```ts
branch_id uuid null references branches(id)
model text null
notes text null
last_test_print_at timestamptz null
```

Migration strategy:

- Add `branch_id` nullable first.
- Backfill existing printers to the default branch.
- Make `branch_id` required after Quickarte print paths are branch-aware.

Tenant-scoped: yes. Branch-scoped: yes after migration hardening.

#### New `printer_assignments`

This avoids overloading the existing `station` enum and supports customer-copy/fallback.

```ts
printer_assignments {
  id uuid primary key default gen_random_uuid()
  business_id uuid not null
  branch_id uuid not null references branches(id) on delete cascade
  printer_id uuid not null references printers(id) on delete cascade
  role varchar(32) not null // receipt, kitchen, bar, customer_copy
  priority integer not null default 0
  fallback_printer_id uuid null references printers(id)
  enabled boolean not null default true
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
}
```

Constraints:

- Unique `(branch_id, role, printer_id)`.
- `fallback_printer_id != printer_id`.

Tenant-scoped: yes. Branch-scoped: yes.

#### Existing `print_jobs`

Do not duplicate. Future additions may include:

```ts
business_id uuid null
branch_id uuid null
assignment_role varchar(32) null
```

These should be added only when the print pipeline is refactored to branch-aware routing.

#### Existing `category_print_routes`

Future additions:

```ts
branch_id uuid null references branches(id)
```

Migration strategy:

- Backfill to default branch.
- Change key from `(business_id, category_id, station)` to `(branch_id, category_id, station)` after Module 3 menu branch model is settled.

### 2.7 Payment Methods

#### New `payment_method_definitions`

Global lookup for built-in methods.

```ts
payment_method_definitions {
  code varchar(32) primary key // cash, cmi_card, inwi_money, orange_money, marocpay, voucher, comp, other
  label text not null
  category varchar(32) not null // cash, card, wallet, voucher, comp, custom
  is_builtin boolean not null default true
  sort_order integer not null default 0
}
```

Tenant-scoped: no. Branch-scoped: no.

#### New `branch_payment_methods`

```ts
branch_payment_methods {
  id uuid primary key default gen_random_uuid()
  business_id uuid not null
  branch_id uuid not null references branches(id) on delete cascade
  method_code varchar(32) null references payment_method_definitions(code)
  custom_name text null
  enabled boolean not null default true
  cash_drawer_auto_open boolean not null default false
  sort_order integer not null default 0
  metadata jsonb null
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
}
```

Constraints:

- Built-in row: `method_code is not null and custom_name is null`.
- Custom row: `method_code is null and custom_name is not null`.
- Unique `(branch_id, method_code)` where `method_code is not null`.

Tenant-scoped: yes. Branch-scoped: yes.

CMI note:

- `cmi_card` can be enabled/disabled here, but credentials, tokenization, reconciliation, and offline payment capture are Module 8 work.

## API Surface Proposal

All endpoints:

- Are under `/v1`.
- Use OpenAPI decorators.
- Use `withTenant()` for database access.
- Use `@RequirePermission()`.
- Return Problem Details errors.
- Use `business_id` from JWT tenant context.
- Treat wrong-tenant branch IDs as 404.

Suggested new permissions:

- `business.view`
- `business.update`
- `branch.view`
- `branch.create`
- `branch.update`
- `branch.delete`
- `settings.view`
- `settings.update`
- `tax.view`
- `tax.update`
- `printer.view`
- `printer.manage`
- `payment_methods.view`
- `payment_methods.update`

Some already exist from Phase 0 starter permissions (`business.view`, `business.update`). Missing permissions should be seeded in the implementation milestone that introduces the endpoints.

### Business Profile

#### `GET /v1/businesses/me/setup`

Purpose: Fetch business setup profile, legal profile, and default branch summary.

Permission: `business.view`

Response sketch:

```json
{
  "business": {
    "id": "uuid",
    "name": "Cafe Atlas",
    "slug": "cafe-atlas",
    "type": "cafe",
    "currency": "MAD",
    "secondaryCurrency": null,
    "timezone": "Africa/Casablanca",
    "locale": "fr-MA",
    "logo": null
  },
  "legalProfile": {
    "legalName": "Cafe Atlas SARL",
    "iceNumber": null,
    "rcNumber": null,
    "ifNumber": null,
    "patenteNumber": null,
    "cnssNumber": null
  },
  "defaultBranch": {
    "id": "uuid",
    "name": "Main",
    "slug": "main"
  }
}
```

#### `PATCH /v1/businesses/me/setup`

Purpose: Update business-level setup fields and legal profile.

Permission: `business.update`

Request sketch:

```json
{
  "name": "Cafe Atlas",
  "type": "cafe",
  "currency": "MAD",
  "secondaryCurrency": "EUR",
  "timezone": "Africa/Casablanca",
  "locale": "fr-MA",
  "legalProfile": {
    "legalName": "Cafe Atlas SARL",
    "iceNumber": "string",
    "rcNumber": "string",
    "ifNumber": "string",
    "patenteNumber": "string",
    "cnssNumber": "string"
  }
}
```

### Branches

#### `GET /v1/branches`

Purpose: List branches for the current business.

Permission: `branch.view`

Response sketch:

```json
{
  "branches": [
    {
      "id": "uuid",
      "name": "Main",
      "slug": "main",
      "isDefault": true,
      "status": "active",
      "city": "Casablanca",
      "phone": "+212..."
    }
  ]
}
```

#### `POST /v1/branches`

Purpose: Create a branch.

Permission: `branch.create`

Request sketch:

```json
{
  "name": "Maarif",
  "slug": "maarif",
  "addressLine1": "string",
  "city": "Casablanca",
  "postcode": "20000",
  "phone": "string",
  "email": "string",
  "seatingCapacity": 60,
  "timezone": "Africa/Casablanca",
  "locale": "fr-MA"
}
```

#### `GET /v1/branches/{branchId}`

Purpose: Get one branch profile.

Permission: `branch.view`

#### `PATCH /v1/branches/{branchId}`

Purpose: Update branch profile.

Permission: `branch.update`

#### `POST /v1/branches/{branchId}/set-default`

Purpose: Set default branch for single-location fallbacks.

Permission: `branch.update`

#### `DELETE /v1/branches/{branchId}`

Purpose: Soft-delete/deactivate a branch.

Permission: `branch.delete`

Rules:

- Cannot delete the only active branch.
- Cannot hard-delete a branch with orders, stock movements, or audit history.

### Operating Hours

#### `GET /v1/branches/{branchId}/operating-hours`

Purpose: Fetch normal/Ramadan schedule and closed days.

Permission: `settings.view`

#### `PUT /v1/branches/{branchId}/operating-hours`

Purpose: Replace operating schedule atomically.

Permission: `settings.update`

Request sketch:

```json
{
  "ramadanModeEnabled": false,
  "hours": [
    {
      "scheduleType": "normal",
      "dayOfWeek": 1,
      "opensAt": "09:00",
      "closesAt": "23:00",
      "isClosed": false,
      "position": 0
    }
  ],
  "closedDays": [
    {
      "date": "2026-01-01",
      "reason": "Holiday"
    }
  ]
}
```

### Tax Configuration

#### `GET /v1/tax-rates`

Purpose: Return global Moroccan TVA rates.

Permission: `tax.view`

#### `GET /v1/branches/{branchId}/tax-config`

Purpose: Fetch branch tax settings and overrides.

Permission: `tax.view`

#### `PUT /v1/branches/{branchId}/tax-config`

Purpose: Update branch tax settings.

Permission: `tax.update`

Request sketch:

```json
{
  "defaultTaxRateId": "ma_tva_10",
  "taxApplicationLevel": "category",
  "priceDisplayMode": "ttc",
  "serviceChargeEnabled": true,
  "serviceChargeRate": "10.00",
  "serviceChargeLabel": "Frais de service"
}
```

#### `PUT /v1/branches/{branchId}/tax-config/categories/{categoryId}`

Purpose: Assign tax rate to a category.

Permission: `tax.update`

Implementation note: build this only when Module 3 menu branch model is being implemented, unless PM approves doing category overrides earlier.

#### `PUT /v1/branches/{branchId}/tax-config/products/{productId}`

Purpose: Assign tax rate to a product.

Permission: `tax.update`

Implementation note: defer to Module 3 menu/product work.

### Receipt Customization

#### `GET /v1/branches/{branchId}/receipt-settings`

Purpose: Fetch receipt settings.

Permission: `settings.view`

#### `PUT /v1/branches/{branchId}/receipt-settings`

Purpose: Replace receipt settings.

Permission: `settings.update`

Request sketch:

```json
{
  "logoUrl": null,
  "headerLines": [{ "locale": "fr", "text": "Bienvenue" }],
  "footerLines": [{ "locale": "fr", "text": "Merci" }],
  "showItemCodes": false,
  "showTaxBreakdown": true,
  "showServerName": true,
  "showTableNumber": true,
  "bilingualMode": "stacked",
  "paperWidth": "80mm",
  "qrCodeMode": "fidelity_signup",
  "qrCodeUrl": null
}
```

#### `POST /v1/branches/{branchId}/receipt-settings/preview`

Purpose: Generate a preview payload or text receipt sample.

Permission: `settings.view`

Note: This should use the existing printing formatter when implemented.

### Printer Setup

#### `GET /v1/branches/{branchId}/printers`

Purpose: List branch printers and assignments.

Permission: `printer.view`

#### `POST /v1/branches/{branchId}/printers`

Purpose: Add a printer manually.

Permission: `printer.manage`

Request sketch:

```json
{
  "name": "Kitchen LAN",
  "connectionType": "escpos_lan",
  "address": "192.168.1.50:9100",
  "enabled": true
}
```

#### `PATCH /v1/branches/{branchId}/printers/{printerId}`

Purpose: Update printer metadata or enable/disable.

Permission: `printer.manage`

#### `DELETE /v1/branches/{branchId}/printers/{printerId}`

Purpose: Soft-delete printer.

Permission: `printer.manage`

#### `POST /v1/branches/{branchId}/printers/{printerId}/test-print`

Purpose: Queue or send test print through existing print pipeline.

Permission: `printer.manage`

#### `PUT /v1/branches/{branchId}/printer-assignments`

Purpose: Replace receipt/kitchen/bar/customer-copy assignments and fallbacks.

Permission: `printer.manage`

Request sketch:

```json
{
  "assignments": [
    {
      "printerId": "uuid",
      "role": "kitchen",
      "priority": 0,
      "fallbackPrinterId": null,
      "enabled": true
    }
  ]
}
```

#### `POST /v1/branches/{branchId}/printers/discover`

Purpose: Start network discovery.

Permission: `printer.manage`

Note: Implementation should be best-effort and may be limited by hosting/network environment. USB discovery is device-local and likely belongs in POS terminal or local print agent, not cloud API.

### Payment Methods

#### `GET /v1/payment-method-definitions`

Purpose: Fetch built-in method definitions.

Permission: `payment_methods.view`

#### `GET /v1/branches/{branchId}/payment-methods`

Purpose: Fetch enabled/disabled branch payment methods.

Permission: `payment_methods.view`

#### `PUT /v1/branches/{branchId}/payment-methods`

Purpose: Replace payment method configuration.

Permission: `payment_methods.update`

Request sketch:

```json
{
  "methods": [
    {
      "methodCode": "cash",
      "enabled": true,
      "cashDrawerAutoOpen": true,
      "sortOrder": 0
    },
    {
      "methodCode": "cmi_card",
      "enabled": true,
      "cashDrawerAutoOpen": false,
      "sortOrder": 1
    },
    {
      "customName": "Staff meal",
      "enabled": true,
      "cashDrawerAutoOpen": false,
      "sortOrder": 10
    }
  ]
}
```

## Implementation Milestone Breakdown

### M2.1 - Branch Foundation + Restaurant Profile

Scope:

- Add `branches` and `business_legal_profiles`.
- Create default branch for every existing business.
- Add strict RLS for new tables.
- Add API endpoints for business setup and branch CRUD.
- Add admin-web Restaurant Profile + Branches settings pages using Mizan tokens.
- Do not refactor menu/orders yet.

Why first:

- Branch identity is the dependency for all other Module 2 settings.
- Default branch migration de-risks existing Quickarte data.

### M2.2 - Operating Hours + Payment Methods

Scope:

- Add branch operating hours, Ramadan mode, and closed days.
- Add payment method definitions and branch payment method config.
- Add API endpoints and admin-web screens.

Why second:

- These are self-contained branch settings and low-risk after branches exist.
- Payment method config is needed before POS order tendering.

### M2.3 - Tax Configuration

Scope:

- Add Moroccan TVA lookup and branch tax settings.
- Add API/admin screens for default tax, TTC/HT display, and service charge.
- Define but do not fully implement category/product override UI until Module 3 if PM approves.

Why third:

- Tax config is required before menu pricing and order totals are built.
- It has downstream implications for receipts and reports.

### M2.4 - Receipt Customization

Scope:

- Add branch receipt settings.
- Extend existing receipt formatter to consume settings for previews.
- Add admin-web receipt settings screen.
- Keep actual order receipt generation compatible with current Quickarte print pipeline.

Why fourth:

- Receipt settings depend on tax display choices and branch profile.

### M2.5 - Printer Setup

Scope:

- Add `branch_id` to printers with default-branch backfill.
- Add printer assignments/fallbacks.
- Add API/admin printer setup screens.
- Extend Quickarte print abstraction rather than replacing it.
- Add test print endpoint.

Why fifth:

- Printer setup touches existing production print code and should come after lower-risk settings.

### M2.6 - Compatibility, Smoke Tests, and SDK Finalization

Scope:

- Run Quickarte compatibility sweep.
- Verify branch default behavior for existing QR/order flows.
- Verify API SDK generated types for all Module 2 endpoints.
- Verify RLS tests for new tables.
- Document any Module 3 handoff items.

Why sixth:

- Module 2 changes establish branch foundations that Module 3/Menu will inherit.

## Open Decisions for PM

1. Branch model.
   - Recommendation: approve Option A, first-class `branches` under `businesses`.
   - Reason: it is the only option that satisfies Module 2.2 without a later rewrite.

2. `businesses.name` meaning.
   - Recommendation: treat `businesses.name` as the trade/display name and do not add `trade_name`.
   - PM decision: if legal invoice trade name must differ from public display name, add `business_legal_profiles.trade_name`.

3. Legal address.
   - Recommendation: operating address is branch-level; legal address is optional in `business_legal_profiles`.
   - PM decision: whether legal address is required for Moroccan compliance in Module 2 MVP.

4. Legacy operational table branch migration timing.
   - Recommendation: create branches now, branch-scope new Module 2 tables now, and migrate legacy menu/orders/staff/reservation tables in the modules that own those workflows.
   - Reason: adding branch IDs everywhere immediately risks Quickarte regressions.

5. Staff branch model.
   - Recommendation: keep `staff_members` business-scoped and add `staff_branch_assignments`.
   - Reason: one employee can work across multiple branches.

6. Tax override timing.
   - Recommendation: implement branch default tax settings in Module 2; implement category/product overrides alongside Module 3 menu work.
   - Reason: existing categories/products are not branch-aware yet.

7. Printer model.
   - Recommendation: add `branch_id` to existing `printers`, keep current fields for compatibility, and add `printer_assignments` for receipt/kitchen/bar/customer-copy/fallback.
   - PM decision: approve this extension path instead of replacing the existing printer model.

8. Bluetooth printer support.
   - Recommendation: defer Bluetooth unless a pilot device requires it. Keep M2 focused on `escpos_lan`, `escpos_usb`, and `webprint`.
   - Reason: Phase 0 locked hardware baseline did not require Bluetooth, and Bluetooth discovery is device-local.

9. Receipt settings level.
   - Recommendation: branch-level receipt settings with business logo fallback.
   - Reason: each branch may need its own fiscal address, printer paper width, footer, and QR target.

10. Payment method level.
    - Recommendation: branch-level payment methods.
    - Reason: branches may accept different wallets/card devices/cash drawer behavior.

11. CMI in Module 2.
    - Recommendation: configuration can expose `cmi_card` enabled/disabled, but no CMI credentials, processing, tokenization, or offline card capture until Module 8.

12. Admin-web visual system.
    - Recommendation: Module 2 implementation screens must consume `docs/design/mizan-tokens.css`; no design-token application is done in this design milestone.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Duplicating existing business/profile fields | Confusing data model and broken Quickarte assumptions | Reuse `businesses.name`, `slug`, `logo`, `currency`, `timezone`, `locale`; put only legal gaps in `business_legal_profiles`. |
| Branch migration breaks Quickarte | Production QR/order behavior regresses | Default branch first; branch-scope new Module 2 tables; migrate legacy tables by owning module. |
| Printer redesign conflicts with Quickarte pipeline | Print jobs fail or route incorrectly | Extend `printers`, `print_jobs`, and `category_print_routes`; do not create a parallel print system. |
| Tax config lands before branch-aware menu | Duplicate tax override work | Build branch tax defaults now; defer category/product overrides to Module 3 unless PM decides otherwise. |
| RLS forgotten on new tables | Cross-tenant leak risk | Every new tenant-scoped table ships with `business_id` and strict RLS in the same migration. |
| Business vs branch permissions are too broad | Owner/staff can alter wrong branch settings | Permissions should be tenant-wide in Module 2, with branch-level access restrictions added when staff branch assignment becomes active in employee module. |

## Non-Goals For Module 2 Implementation

- No menu/recipe/stock feature work.
- No POS order-taking screens.
- No CMI payment processing.
- No DGI e-invoicing.
- No cross-branch reports.
- No rewrite of Quickarte QR/menu flows.
- No separate printer subsystem.
- No implementation during this design milestone.

## PM Decisions - Locked

1. Branch model: Option A is approved. `business_id` remains the RLS tenant key. `branch_id` is a filtering and authorization dimension, never the tenant key.
2. `businesses.name` is the trade/display name. `legal_name` lives in `business_legal_profiles`. No `trade_name` column.
3. Legal address is optional in Module 2. Legal address fields are present but not enforced. Phase 2 DGI work will require it.
4. Legacy operational table branch migration is phased module-by-module.
5. `staff_members` stays business-scoped. `staff_branch_assignments` is deferred to Module 11 and must not be created in Module 2.
6. Branch default tax lands in Module 2. Category and product tax overrides are deferred to Module 3.
7. Printers will be extended with `branch_id`, and `printer_assignments` will be added. Existing printer fields stay in place.
8. Bluetooth implementation is deferred because it is device-local and belongs with POS-terminal work, but `bluetooth` is included as a valid `connection_type` value in the data model now.
9. Receipt settings are branch-level, with business logo fallback.
10. Payment methods are branch-level.
11. CMI is config-only in Module 2: enable/disable only, with no processing until Module 8.
12. Module 2 admin-web screens consume `docs/design/mizan-tokens.css`.
