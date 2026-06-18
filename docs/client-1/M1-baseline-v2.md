# M1 Baseline v2 — Re-baselined Against Expanded Scope

**Date:** 2026-05-20 · **Branch:** `client-1/m1-baseline-v2` · **Base:** `main` @ `10af043`
**Type:** read-only planning pass. No code, schema, migration, or file outside `docs/client-1/` was changed.

**Purpose:** `docs/client-1/M1-baseline.md` (the "v1 baseline") surveyed `main` accurately, but it
was written before two scope additions landed. The contract has since changed. This doc treats v1
as the starting line and re-baselines M1 against the expanded scope:

1. **Home delivery** as a Quickarte-mediated channel (restaurant does its own logistics).
2. **CMI online payment** required on delivery orders only (no-show prevention).

**Headline finding:** the v1 baseline still holds for the in-restaurant loop — that part of M1 is
~70% shipped. But M1's *surface area roughly doubles*: delivery is a real new channel with its own
entry-point routing, fee model, and a hard prepayment gate. The v1 7-item changeset is retired and
replaced (§5). One pleasant surprise: the `order_type` enum already carries `delivery` — see §2.

> **Scope-document note.** `CLIENT_1_SCOPE.json` (repo root, v1.0) is *also* now partially stale:
> its `out_of_scope` list still names "CMI payment integration," and it models no delivery channel.
> Where this doc and `CLIENT_1_SCOPE.json` disagree, the expanded contract in the re-baseline
> brief wins. The scope file should be revised separately; that is not part of this pass.

---

# 1. Updated changeset (replaces the v1 7-item list)

Dependency-ordered. Migration numbering continues from `0020_loyalty_credits.sql` → next is `0021`.
Tracks **B**, **C**, and **D/E** are independent of each other and can run in parallel once **A**
lands. Track **F** depends only on **A**.

### Phase A — Data-model foundation (unblocks everything)

1. **Migration `0021` — payment + delivery data model.** One migration covering: the new
   `payment_method` enum and the new columns on `orders`; the three new tables (`delivery_zones`,
   `merchant_payment_config`, `payment_sessions`); the supporting `business_settings` columns.
   Full DDL is enumerated in §2. **No `order_type` enum change is needed** — `delivery` is already
   a value (§2.4). Everything below depends on this migration.

### Phase B — In-restaurant payment capture (no delivery / no CMI)

2. **`markOrderPaid` server action** — `lib/ordering/actions.ts`: `markOrderPaid(orderId, method)`
   where `method ∈ {cash, card}`. Sets `payment_status = 'paid'`, `payment_method`, `paid_at`;
   records an `order_events` row (`order.paid`); gates on the **already-defined but currently
   dead** `orders.mark_paid` permission (`lib/identity/permissions.ts:11`). Applies to
   **in-restaurant orders only** — CMI delivery orders are born paid (Phase E).
3. **Cashier pay surface** — extend `app/[locale]/(merchant)/orders/page.tsx` +
   `components/merchant/order-row.tsx` with cash/card pay actions and the "ready" notification.
   Re-using the `/orders` board is the lower-effort, no-over-engineering path (v1 §1.4 verdict
   still stands; a dedicated POS route is not warranted for one restaurant).

### Phase C — Prep priority (fully independent — can start anytime after A, or before)

4. **`prep_priority` on products** — migration adds `prep_priority` (integer) to `products`
   (`lib/db/schema/catalog.ts`); sorting added in `lib/kitchen/queries.ts` (`getOpenKitchenOrders`)
   and `components/kitchen/kitchen-board.tsx` (`bucketOrders`); a manager edit control in
   `app/[locale]/(merchant)/catalog/*`. Unchanged from v1 — still missing, still small. (Can be
   its own migration or folded into `0021`.)

### Phase D — Delivery channel (entry-point + zones + fees; no CMI yet)

5. **Make `deliveryEnabled` editable.** The `delivery_enabled` column already exists on
   `business_settings` (`lib/db/schema/business.ts:75`, default `false`) but is **unreachable** —
   the `updateOperationalSettings` zod schema validates only `dineInEnabled` + `takeawayEnabled`
   (`lib/business/actions.ts:249-252`) and its `.refine` ignores delivery. Add `deliveryEnabled`
   to that schema and `.refine`, and add the toggle to the Modules settings section
   (`components/merchant/settings-sections.tsx`, `OperationalSettingsSection`).
6. **Delivery zones + fee calc** — CRUD over the new `delivery_zones` table (§2.2); a pure fee
   module `lib/delivery/fee.ts` (`resolveDeliveryFee(business, location) → fee`); a merchant zones
   editor (new settings section/sub-route). Everything editable by the merchant per scope.
7. **Entry-point routing** — QR codes carry `?source=qr`; the storefront branches the order modes
   on its presence. Files in §3.
8. **`placeOrder` / schema — delivery support** — `lib/ordering/schemas.ts`: add `delivery` to
   `orderType`, conditionally require `delivery_address` + phone. `lib/ordering/actions.ts`: for
   `delivery`, **do not insert an order** — route to the CMI checkout (Phase E). `dine_in` /
   `takeaway` keep the existing direct-insert path.

### Phase E — CMI integration (depends on D for the delivery order shape)

9. **`lib/payments/cmi.ts` — the single CMI module.** Per the constraint, this is the *only* file
   that knows CMI exists. No provider abstraction. Exports: `buildHostedPaymentRequest()` (params
   + signature for the hosted page), `verifyIpnHash()`, `requestRefund()`, and
   `encryptCredentials()` / `decryptCredentials()` for creds at rest.
10. **Merchant CMI config** — `merchant_payment_config` storage (§2.3); a new symmetric encryption
    key env var (§2.3); a save server action (`lib/payments/config-actions.ts`) that calls
    `cmi.ts` to encrypt; a merchant CMI settings UI section.
11. **CMI checkout** — `startDeliveryCheckout` server action (`lib/payments/checkout-actions.ts`):
    creates a `payment_sessions` row (§2.4), builds the hosted-page request via `cmi.ts`, returns
    the redirect. Customer → CMI hosted page → 3DS.
12. **CMI IPN webhook** — new route `app/api/payments/cmi/ipn/route.ts`: verifies the hash via
    `cmi.ts`; on success **materializes** the order (`status = 'pending'`,
    `payment_status = 'paid'`, `payment_method = 'online'`) from the staged `payment_session`; on
    failure/timeout, no order is created. Idempotent on the CMI transaction id.
13. **CMI return page + refund** — a customer-facing return route
    (`app/[locale]/(storefront)/[slug]/order/payment-return/`) reporting success/failure; a
    merchant-triggered refund (`app/api/payments/cmi/refund/route.ts` or a server action) calling
    `cmi.ts.requestRefund()`.

### Phase F — Cloture (depends only on A)

14. **Cloture revenue split** — `lib/analytics/close-of-day-orders.ts` +
    `close-of-day-csv.ts`: split totals by `payment_method` — **cash**, **card (TPE)**, **online
    (CMI)** — and add a **delivery-fees** line (`SUM(delivery_fee)`). `formatOrderTypeFr` already
    renders `delivery` → "Livraison" (`close-of-day-csv.ts:146`), so delivery orders already
    appear in the list; only the totals block needs the split. (Glovo column stays out — that is
    M2; see §5.)

---

# 2. Data-model changes

Verified against `lib/db/schema/ordering.ts`, `business.ts`, `catalog.ts` on `main` @ `10af043`.

## 2.1 `orders` — new columns

| Column | Type | Null? | Purpose |
|---|---|---|---|
| `payment_method` | new enum `payment_method` | nullable | How the order was tendered. Set only when paid. NULL = unpaid. |
| `delivery_address` | `text` | nullable | Free-text delivery address. Only set for `type = 'delivery'`. |
| `delivery_fee` | `numeric(10,2)` | `NOT NULL DEFAULT '0.00'` | Merchant delivery fee charged on top of goods. `0.00` for non-delivery orders — existing rows backfill cleanly. |
| `payment_ref` | `text` | nullable | CMI transaction id (`oid` / `TransId`). Used to correlate the IPN, enforce idempotency, and drive refunds. Do **not** reuse the Stripe vestige columns. |

**New enum:** `payment_method` = `('cash', 'card', 'online')`.
- `cash` / `card` — in-restaurant tender captured by the cashier (Phase B).
- `online` — prepaid via the CMI hosted page (Phase E). Distinct from `card` on purpose: the
  merchant reconciles three separate money pots (cash drawer, TPE settlement, CMI settlement) —
  cloture's split (§1.14) needs them apart.
- **Glovo** is **not** a value here. Glovo one-tap logging is M2 (§5); add a `glovo` value to this
  enum then, not now.

**`total` semantics — keep unchanged.** `total` stays "sum of line-item subtotals" (goods only),
exactly as today. `delivery_fee` is stored separately. The amount charged to CMI =
`total + delivery_fee`. This avoids redefining `total`, which cloture (`SUM(total)` as
`revenueMad`) and every order view already depend on. Confirm with the founder that the customer
prepays goods **+** fee (the brief says yes).

## 2.2 Existing `orders` fields that already cover the need — no change

- **`type` (`order_type` enum)** — already `('dine_in', 'takeaway', 'delivery')`. See §2.4.
- **`payment_status` (`payment_status` enum)** — already `('unpaid', 'paid', 'refunded', 'failed')`.
  This already covers the full CMI lifecycle (`paid` on IPN success, `failed`, `refunded`). **No
  migration needed for payment status.**
- **`paid_at`** — `timestamp` column already exists (`ordering.ts:104`).
- **`customer_name` / `customer_phone`** — exist. `customer_phone` is **nullable** (made optional
  by commit `5b157d6`). Keep the column nullable; require phone for delivery at the **zod layer**
  only (`lib/ordering/schemas.ts`), not in the DB.
- **`customer_access_token`** — the order-tracker link works for delivery orders unchanged.
- **`order_events` table** — journal all CMI events here (`payment.initiated`, `payment.captured`,
  `payment.failed`, `payment.refunded`). **No new events table.**

## 2.3 New tables

### `delivery_zones` (per business) — **recommend radius bands**

```
delivery_zones (
  id           uuid     PK default gen_random_uuid()
  business_id  uuid     FK businesses(id) ON DELETE CASCADE, NOT NULL
  name         text     NOT NULL          -- merchant label, e.g. "Centre-ville"
  radius_m     integer  NOT NULL          -- outer radius in metres from the business location
  fee          numeric(10,2) NOT NULL     -- flat fee for this band; 0.00 = free zone
  sort_order   integer  NOT NULL          -- evaluated innermost-first
  created_at / updated_at timestamptz
)
```

**Recommendation: concentric radius bands, not polygons.** Reasoning:

- The scope describes pricing in *distance* terms — "free-delivery **inside-zone**, paid zones
  **outside that**, flat fee for anywhere **outside any** defined zone." That is a set of
  concentric bands by description. Radius models it 1:1: each band = `{radius_m, fee}`; "inside" is
  the smallest radius with `fee = 0`; the catch-all is everything past the largest radius.
- The origin is free: `businesses` already stores `lat` / `lng` (`numeric(10,7)`,
  `business.ts:35-36`). A band is then a single integer.
- Polygons would need a map-drawing merchant UI, geometry storage, and either PostGIS or a
  point-in-polygon library. That is real over-engineering for one restaurant whose pricing is
  concentric anyway. **The simpler shape *can* express the merchant's pricing → choose it.**

**The catch-all fee** ("anywhere outside any defined zone") lives on `business_settings` as
`delivery_outside_fee numeric(10,2)`, so every `delivery_zones` row stays uniform (all have a real
radius). `resolveDeliveryFee` picks the innermost band whose `radius_m` contains the customer, else
`delivery_outside_fee`.

> **The honest catch — see Open Question O-5.** Radius needs the *customer's coordinates* at
> checkout (the fee must be shown *before* the CMI redirect, per the flow). The customer types a
> free-text address; geocoding Moroccan free-text addresses reliably is hard. The pragmatic
> fallback, if geocoding proves unreliable, is to keep this table but make zones **customer-
> selected named flat-fee rows** (drop `radius_m`, the customer picks "Quartier X — 10 MAD" from a
> list). That is *even simpler* than radius and needs no geometry or geocoding at all. Which of the
> two — automatic distance-based vs. customer-selected — is a founder/merchant decision; the table
> shape above supports radius and degrades to a named-list with one column dropped.

### `merchant_payment_config` (per business) — where CMI credentials live

**Recommendation: a new dedicated table, *not* columns on `business_settings`.** `business_settings`
is a hot row pulled into many general reads (`placeOrder` already selects from it,
`lib/ordering/actions.ts:103-110`); secrets should not ride along in those reads, even encrypted.
A separate 1:1 table keeps credential access explicitly scoped.

```
merchant_payment_config (
  id                       uuid PK default gen_random_uuid()
  business_id              uuid FK businesses(id) ON DELETE CASCADE, UNIQUE, NOT NULL
  cmi_merchant_id          text                       -- not secret; CMI "clientid"
  cmi_store_key_encrypted  text                       -- encrypted at rest (AES-256-GCM)
  cmi_ipn_secret_encrypted text                       -- encrypted at rest; see note
  success_redirect_url     text
  failure_redirect_url     text
  enabled                  boolean NOT NULL default false
  created_at / updated_at  timestamptz
)
```

- **Encryption at rest.** Add one new server-side env var, e.g. `PAYMENT_CONFIG_ENC_KEY`
  (32-byte base64; validate in `lib/env.ts` with the existing `base64Schema`). `encryptCredentials`
  / `decryptCredentials` live **inside `lib/payments/cmi.ts`** (or a sibling `lib/payments/crypto.ts`
  imported only by `cmi.ts`) so the "all CMI touchpoints in one module" rule holds. There is no
  existing app-level encryption key today — `BETTER_AUTH_SECRET` exists but should not be reused
  for this.
- **`cmi_ipn_secret` note.** In common CMI hosted-page integrations the IPN callback hash is keyed
  by the *same store key* as the request — there is often no separate IPN secret. The field is kept
  per the brief, but whether it is distinct from the store key depends on the merchant's CMI hash
  version → Open Question O-2.

### `payment_sessions` — staging for the "no order until paid" rule

**This table is required by the contract**, even though the brief did not name it. The rule "if
payment fails or times out, **no order is created**" means a delivery order must not exist in
`orders` before the IPN confirms payment. But the cart lives client-side (`lib/ordering/cart-store.ts`,
zustand) and is gone the moment the browser leaves for the CMI hosted page. The intended order must
therefore be **staged server-side** before redirect and **materialized** by the IPN.

```
payment_sessions (
  id            uuid PK default gen_random_uuid()
  business_id   uuid FK businesses(id) ON DELETE CASCADE, NOT NULL
  cmi_oid       text UNIQUE NOT NULL        -- the oid sent to CMI / echoed in the IPN
  amount        numeric(10,2) NOT NULL      -- goods + delivery_fee, what CMI charges
  delivery_fee  numeric(10,2) NOT NULL
  customer_name / customer_phone / delivery_address  text
  items_json    jsonb NOT NULL             -- validated cart lines, ready to become order_items
  status        text NOT NULL default 'pending'  -- pending | consumed | failed | expired
  order_id      uuid FK orders(id)         -- set when the IPN materializes the order
  created_at / expires_at  timestamptz
)
```

The alternative — create the order immediately as `unpaid` and reap abandoned ones with a cron —
violates the explicit "no order is created" rule and leaves junk rows in `orders`. Staging is the
clean fit. (`cmi_oid` can be a fresh UUID; do not reuse `orders.id`, since the order does not exist
yet.)

## 2.4 `order_type` enum — confirmation: **NO change needed**

The brief asked to "confirm `order_type` needs a `delivery` value added (existing:
`dine_in | takeaway | click_and_collect`)." **That premise is wrong, in the project's favour:**

- The live enum is `order_type = ('dine_in', 'takeaway', 'delivery')` — `lib/db/schema/ordering.ts:21-25`,
  created that way in the very first migration `0000_broad_spiral.sql`. **`delivery` already
  exists.** No enum migration.
- **`click_and_collect` is not, and never was, an `order_type` value.** It appears only as
  marketing copy in `components/marketing/landing-page.tsx` and as a free-form string argument in
  `lib/ordering/customer-view.test.ts:50` — never in the schema. "Click-and-collect" in the brief
  maps to the existing `takeaway` value ("À Emporter"); no separate enum value is required.

What *is* missing is not the enum value but the *plumbing*: `placeOrder`'s payload type and
`placeOrderSchema` both hard-restrict `orderType` to `('dine_in', 'takeaway')`
(`lib/ordering/actions.ts:63`, `lib/ordering/schemas.ts:11`), and `CheckoutForm`'s `OrderType` type
is `"dine_in" | "takeaway"` (`components/storefront/checkout-form.tsx:33`). No code path can
*create* a delivery order today. That is Phase D work, not a schema change.

## 2.5 `business_settings` — new columns

- `delivery_outside_fee numeric(10,2) NOT NULL DEFAULT '0.00'` — the catch-all delivery fee (§2.3).
- (`delivery_enabled` already exists — `business.ts:75` — it just needs to be made *editable*; see
  changeset item 5. No new column.)

---

# 3. Entry-point routing

**Today there is no QR-vs-link distinction.** The QR code encodes `/{slug}?table=N`; the storefront
reads `?table` only as a table *number*, not as an entry *signal*, and always offers both modes.
The chain:

- `app/[locale]/(storefront)/[slug]/page.tsx:23,45` — reads `?table` via `parseTableNumber`
  (`lib/ordering/table.ts`), passes `initialTableNumber` to `StorefrontMenu`.
- `components/storefront/storefront-menu.tsx:230` — the "voir le panier" button appends `?table=N`
  to the `/order` link **only if a table number is present**.
- `app/[locale]/(storefront)/[slug]/order/page.tsx:14-19,55-58` — reads `?table`, and passes
  `dineInEnabled` / `takeawayEnabled` (but **not** `deliveryEnabled`) to `CheckoutForm`.
- `components/storefront/checkout-form.tsx:33,196-216` — `OrderType = "dine_in" | "takeaway"`; the
  mode toggle renders Sur place / À emporter from those two flags. No Livraison option exists.

**Recommendation — the simplest mechanism: a `?source=qr` URL parameter on the QR code itself.**

- Table QR codes encode `/{slug}?source=qr&table=N` (a counter/takeaway QR with no table:
  `/{slug}?source=qr`). Shared links are the bare `/{slug}` with no `source`.
- `?table` alone is *almost* a sufficient signal, but a takeaway-counter QR has no table number —
  an explicit `?source=qr` is table-independent and unambiguous. Keep `?table` for the table
  number; add `?source` purely as the entry flag.
- The storefront branches on `source`:
  - **`source=qr`** (scanned at a table) → offer **Sur Place + À Emporter**.
  - **no `source`** (link visit) → offer **À Emporter + Livraison**.
  - À Emporter is in both — correct, it applies to either context.

**Files that must change for entry-point routing:**

| File | Change |
|---|---|
| QR URL builder — `components/merchant/settings-sections.tsx` (`TableQrSettingsSection`) and wherever the table-QR links/images are generated | Emit `?source=qr&table=N` instead of `?table=N`. |
| `app/[locale]/(storefront)/[slug]/page.tsx` | Read `?source`; derive an `entryContext` (`qr` \| `link`); pass it to `StorefrontMenu`. |
| `components/storefront/storefront-menu.tsx` | Propagate `?source` (and `?table`) onto the `/order` link (currently line ~230). |
| `app/[locale]/(storefront)/[slug]/order/page.tsx` | Read `?source`; compute the allowed modes; pass `deliveryEnabled` (currently not passed) and the entry context to `CheckoutForm`. |
| `components/storefront/checkout-form.tsx` | **The storefront UI that branches.** Extend `OrderType` with `"delivery"`; render the mode toggle from the entry context (QR → dine_in/takeaway; link → takeaway/delivery); add the delivery **address** field; show the resolved **delivery fee** + grand total before submit. |
| `lib/ordering/schemas.ts` | Add `delivery` to `orderType`; conditionally require `delivery_address` + phone. |
| `lib/ordering/actions.ts` | `placeOrder` accepts `delivery`; for delivery it branches to the CMI checkout (Phase E) instead of inserting an order. |
| `lib/business/actions.ts:249-252` | Add `deliveryEnabled` to `updateOperationalSettings` so the channel can be turned on at all. |

---

# 4. CMI integration touchpoints

The constraint: **all CMI touchpoints isolated to `lib/payments/cmi.ts`**, single provider, single
module, **no payment-provider abstraction**. Every file below imports from `lib/payments/cmi.ts`
and nothing else payment-related — there is no `lib/payments/provider.ts`, no interface, no second
implementation.

| File (all new unless noted) | Role | Imports from `cmi.ts`? |
|---|---|---|
| **`lib/payments/cmi.ts`** | THE module. `buildHostedPaymentRequest()`, `verifyIpnHash()`, `requestRefund()`, `encryptCredentials()` / `decryptCredentials()`. | n/a — it *is* the module |
| `lib/payments/checkout-actions.ts` | `startDeliveryCheckout` server action — stages a `payment_session`, builds the hosted-page redirect. | ✅ only |
| `app/api/payments/cmi/ipn/route.ts` | IPN webhook — verifies the hash, materializes the order on success. | ✅ only |
| `app/[locale]/(storefront)/[slug]/order/payment-return/page.tsx` | Customer browser-return page after 3DS — reports success/failure (reads `payment_session` / order by `oid`; may re-verify the return hash). | ✅ only |
| `app/api/payments/cmi/refund/route.ts` (or a server action) | Merchant-triggered refund. | ✅ only |
| `lib/payments/config-actions.ts` | Saves merchant CMI credentials — calls `cmi.ts` to encrypt before persisting to `merchant_payment_config`. | ✅ only |
| `components/merchant/cmi-settings-section.tsx` | Merchant CMI settings UI (client component). | ❌ — calls the server action; never touches the provider directly. Correct. |

**Confirmed:** the merchant board needs **no** CMI import — online-paid delivery orders arrive
already `payment_status = 'paid'`, `payment_method = 'online'`. `order-row.tsx` shows them as paid
with no cashier mark-paid step; the cashier pay actions (Phase B) apply only to in-restaurant
orders. The single-module rule holds cleanly.

---

# 5. What from the v1 baseline is now stale

The v1 survey of `main` (status machine, KDS, roles, options/variants, print pipeline, cloture)
was **accurate and is re-verified — still valid**. What changed is the **changeset and the gap
framing**.

### The v1 7-item changeset — retired. Item-by-item:

| v1 item | Disposition |
|---|---|
| 1. Product decision: POS coexistence vs. Quickarte-as-POS | **Resolved by the new contract.** Quickarte *is* the in-restaurant payment surface (cashier captures cash/card). `pos_status` / `pos_coexistence_enabled` stay legacy and **untouched** per constraint. No longer an open decision. |
| 2. Payment-method data model | **Still valid, superseded in detail.** v1 proposed enum `cash\|card\|glovo` + "a dedicated `channel` column." v2: enum is `cash\|card\|online` (Glovo deferred to M2); **no `channel` column** — `order_type` already carries the channel (`dine_in\|takeaway\|delivery`). The same migration now also adds `delivery_address`, `delivery_fee`, `payment_ref` (§2.1). |
| 3. `markOrderPaid` action | **Still valid, unchanged** — now changeset item 2. Scoped explicitly to in-restaurant orders. |
| 4. Cashier / POS surface | **Still valid, unchanged** — now changeset item 3. |
| 5. Glovo one-tap logging | **Superseded / deferred.** This is **M2** per `CLIENT_1_SCOPE.json` milestones (`M2 = Cloture + Glovo`). v1 wrongly bundled it into M1. It is **not** in the v2 M1 changeset. |
| 6. Prep priority | **Still valid, unchanged, still missing** — now changeset item 4. `getOpenKitchenOrders` still sorts by `createdAt`; no `prep_priority` field exists. |
| 7. Cloture payment split | **Still valid, expanded.** v1: cash/card/Glovo. v2: cash / card (TPE) / **online (CMI)** + a **delivery-fees** line. Glovo column stays out (M2). Now changeset item 14. |

### Still-true facts from v1 (re-verified on `main` @ `10af043`):

- Order status machine, KDS (minus prep priority), staff roles, options/variants, print pipeline,
  cloture-totals-revenue-only — all shipped exactly as v1 described.
- `orders.mark_paid` is still a **dead permission** — defined in the matrix
  (`permissions.ts:11`, granted to owner/manager/cashier), referenced by no action. Resolved by
  changeset item 2.
- Stripe vestiges remain: `orders.stripe_payment_intent_id`, `stripe_charge_id`,
  `platform_fee_cents`, and the `stripe_events` table (`ordering.ts:101-103,271-284`). Still dead
  weight; still not M1's concern; **do not reuse them for CMI** — add `payment_ref` instead.
- `payment_mode` (`mad` / `credits`) is loyalty-funding and stays distinct from the new
  `payment_method` (cash/card/online tender).

### New since v1 (the re-baseline delta):

- `order_type` already includes `delivery` — the prompt's assumption that the enum is
  `dine_in|takeaway|click_and_collect` is incorrect (§2.4).
- `business_settings.delivery_enabled` already exists but is **dormant** — uneditable because
  it is absent from the `updateOperationalSettings` schema (§1 item 5).
- M1's surface roughly doubles: a whole delivery channel (entry routing, zones, fees) and a hard
  prepayment gate (CMI) join the in-restaurant loop.

---

# 6. Open questions specific to v2

These cannot be answered without founder/merchant input. **O-1 and O-2 are scheduling blockers.**

- **O-1 (blocker) — CMI contract.** Does the merchant already hold a CMI contract — i.e. a CMI
  Merchant ID and store key? With which acquiring bank? CMI merchant onboarding can take weeks; if
  it has not started, it gates the entire delivery+payment milestone regardless of how fast the
  code is written.
- **O-2 (blocker) — CMI hash version & IPN secret.** Which hash algorithm does the merchant's CMI
  store use — legacy SHA1, or the newer `HASHv3` (HMAC-SHA512)? This determines the signing logic
  in `cmi.ts`. Related: does a *separate* IPN secret exist, or does the store key double as the
  callback hash key (common case)? Decides whether `cmi_ipn_secret` is a real field (§2.3).
- **O-3 — CMI test environment.** Is there a CMI sandbox/test endpoint and test cards for 3DS, or
  only production? Affects how the IPN flow can be verified before going live.
- **O-4 — Refund SLA.** What refund turnaround does the merchant promise customers for a
  failed/cancelled delivery? Is refund merchant-triggered (manual, recommended for M1) or expected
  to be automatic on cancellation? Drives the scope of changeset item 13.
- **O-5 — Delivery zone model.** Automatic distance-based fees (radius bands — needs the
  customer's coordinates, hence geocoding or a map pin) or a customer-selected named-zone list (no
  geometry, no geocoding)? This decides whether `delivery_zones.radius_m` is used or dropped
  (§2.3). Recommendation pending this answer.
- **O-6 — Customer location capture.** Free-text address only, or address + map pin / geolocation?
  A radius/distance fee is impossible without coordinates; a named-zone list works with neither.
- **O-7 — Prepaid amount.** Confirm the customer prepays goods **+** delivery fee via CMI (the
  brief implies yes). Confirms `total + delivery_fee` as the CMI charge and keeps `total` =
  goods-only (§2.1).
- **O-8 — TPE / in-restaurant card.** Which bank issued the restaurant's existing card terminal
  (TPE)? Cloture's `card` vs `online` split assumes the merchant reconciles TPE settlement and CMI
  settlement as two separate pots — confirm that is how they think about it.
- **O-9 — Delivery order lifecycle.** A CMI-paid delivery order is created at `status = 'pending'`.
  Does it then flow through the same garçon-confirm → kitchen → ready loop? The status machine's
  terminal state is `completed` — there is no `out_for_delivery` / `delivered`. Is `completed` =
  "handed to the driver / delivered" acceptable for M1, or does the merchant need an explicit
  dispatch/delivered step? (Recommendation: treat `completed` as delivered for M1; revisit if real
  use demands a dispatch state.)
- **O-10 — IPN reliability fallback.** CMI IPNs can be delayed or dropped. The flow creates the
  order *only* on the IPN. If the IPN never arrives but the customer's browser returned "success,"
  the order silently never appears. Is a reconciliation fallback (a CMI payment-inquiry poll
  keyed by `cmi_oid` for stale `pending` `payment_sessions`) in scope for M1, or accepted as a
  known gap for the pilot?
- **O-11 — Glovo confirmation.** Confirm Glovo one-tap logging stays **M2** and is explicitly
  **not** part of M1 (the v1 baseline incorrectly bundled it). This doc assumes M2.

---

# Non-goals (explicit)

- This pass changed nothing — no code, no schema, no migration, no file outside `docs/client-1/`.
- **No payment-provider abstraction.** One provider (CMI), one module (`lib/payments/cmi.ts`).
- `pos_status` / `pos_coexistence_enabled` remain **legacy and untouched** (per the v1 decision).
- Out of scope, still **M3**: stock, recipes, suppliers, low-stock alerts.
- Glovo one-tap logging and the Glovo cloture column are **M2**, not M1.
