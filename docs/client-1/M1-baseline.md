# M1 Baseline — Ground-Truth Survey of `main`

**Date:** 2026-05-20 · **Branch:** `client-1/m1-baseline` · **Base:** `main` @ `10af043`
**Type:** read-only survey. No code, schema, or behaviour changed by this pass.

**Purpose:** the 2026-04-24 audit predates the 2026-05-12 → 2026-05-19 burst (commit `a5fa4e9`
"Phase 1 + Phase 2" and migrations 0011/0014/0016/0018/0019). This doc re-baselines M1 against
what is actually on `main` today, so `CLIENT_1_SCOPE.json`'s `current_state.gap` can be treated
as a verified fact instead of a hypothesis.

**Headline finding:** M1's order loop is mostly already shipped. The genuine M1 build is narrow —
per-dish prep priority, payment-method capture, a Glovo channel, a cloture payment split, and one
product decision (POS coexistence vs. Quickarte-as-POS).

---

# 1. What Phase 1+2 actually shipped

## 1.1 Order status machine — SHIPPED, complete

- **Files:** `lib/ordering/status.ts` (states + transition graph), `lib/ordering/transitions.ts`
  (`transitionOrder()` — the enforcer), `lib/ordering/actions.ts` (server actions),
  `lib/ordering/events.ts` + `order_events` table.
- **Data model:** `order_status` enum — `lib/db/schema/ordering.ts:27-34`; `order_events` table —
  `ordering.ts:143-162`. Migration `0011_order_preparing_ready_statuses.sql` added `preparing`/`ready`.
- **States:** `pending → confirmed → preparing → ready → completed`, plus `cancelled`. Terminal:
  `completed`, `cancelled`.
- **Allowed transitions** (`ORDER_STATUS_TRANSITIONS`, `status.ts:11-21`):
  - `pending` → `confirmed`, `preparing`, `cancelled`
  - `confirmed` → `preparing`, `ready`, `cancelled`
  - `preparing` → `ready`, `cancelled`
  - `ready` → `completed`, `cancelled`
  - `completed` → (none) · `cancelled` → (none)
- **Enforcement:** every status change goes through `transitionOrder()` (`transitions.ts:41-99`):
  one DB transaction, validates via `canTransitionOrderStatus`, updates `orders.status`, writes an
  `order_events` row, and accrues loyalty credits on `→ completed`. Same-status calls are an
  idempotent no-op. No code path writes `orders.status` directly outside this function.
- **What it does today:** a fully validated, journalled order lifecycle. Customer-facing
  `placeOrder` creates `pending`; merchant/kitchen actions move it forward.

## 1.2 Kitchen view / KDS — SHIPPED, minus prep priority

- **Route:** `app/[locale]/kitchen/page.tsx` + `app/[locale]/kitchen/layout.tsx` — its **own route
  group**, not under `(merchant)`.
- **Files:** `components/kitchen/kitchen-board.tsx` (UI), `lib/kitchen/queries.ts`
  (`getOpenKitchenOrders`), `lib/kitchen/buckets.ts` (columns), `lib/kitchen/actions.ts`
  (`fetchKitchenSnapshot`, `kitchenAcceptOrder`, `kitchenMarkReady`), `lib/kitchen/elapsed.ts`,
  `components/kitchen/kitchen-forbidden.tsx`.
- **Access:** role-gated to `owner` / `manager` / `kitchen` (`kitchen/layout.tsx:19`,
  `kitchen/page.tsx:19-23`). No entitlement check (see §2).
- **What it does today:** three columns — `to_prepare` / `in_progress` / `ready` — bucketed by
  order status (`buckets.ts:23-38`). **4-second polling** (`kitchen-board.tsx:28`,
  `POLL_INTERVAL_MS = 4000`), pauses on hidden tab, new-order chime, optimistic updates, 60s
  "ready" linger. Kitchen marks the **whole order** ("Accepter" → `preparing`, "Prêt" → `ready`).
- **Prep priority — MISSING.** `getOpenKitchenOrders` orders by `desc(createdAt)`; within a column
  `bucketOrders` sorts oldest-first by `createdAt` (`kitchen-board.tsx:567-572`). There is no
  `prep_priority` field anywhere in the schema (verified), and no per-dish ordering — items render
  in `order_items.createdAt` order.

## 1.3 Staff roles — SHIPPED, complete

- **Files:** `lib/identity/permissions.ts`, `lib/identity/staff-actions.ts`,
  `components/merchant/staff-management.tsx`, `app/[locale]/(merchant)/settings/staff/page.tsx`.
- **Data model:** `staff_members` + `staff_invite_tokens` tables, `staff_role` enum — migration
  `0014_staff_roles_order_events_printers.sql`. Migration backfills an `owner` row for every
  existing business.
- **Roles:** `owner`, `manager`, `waiter`, `kitchen`, `cashier` (`permissions.ts:5`).
- **Where checks happen:** `assertRole()` / `getStaffRole()` / `canAccess()` / `assertPermission()`
  (`permissions.ts`). Used at route entry (`orders/page.tsx:23`, `kitchen/page.tsx:19`,
  `kitchen/layout.tsx:18`) and inside every order/kitchen server action. Permission matrix over
  `ProtectedResource` at `permissions.ts:24-68`.
- **"garçon" equivalent:** the **`waiter`** role. It is granted `orders.dashboard`,
  `orders.status_update`, `orders.mark_served`. No new role is needed — map "garçon" → `waiter`.

## 1.4 POS coexistence + reconciliation — SHIPPED, but NOT a cashier POS

- **Files:** `lib/ordering/pos-reconciliation.ts`, actions in `lib/ordering/actions.ts:444-501`
  (`markOrderEnteredInPos`, `markOrderPosSkipped`, `revertOrderPosStatus`).
- **Data model:** migration `0018_pos_reconciliation.sql` — `pos_status` enum
  (`not_required`/`pending`/`entered`/`skipped`), `pos_entered_at`, `pos_entered_by_user_id`,
  `pos_reference`, and `business_settings.pos_coexistence_enabled`.
- **What it actually means:** this is **not** Quickarte acting as the POS. It models Quickarte
  *coexisting with the restaurant's existing/external cash register*. When `posCoexistenceEnabled`
  is on, new orders are stamped `pos_status = 'pending'` at creation (`actions.ts:205-207`) —
  meaning "still needs to be re-keyed into the external caisse." Staff then mark each order
  `entered` (with an optional `pos_reference`) or `skipped`. Events: `order.pos_entered` /
  `order.pos_skipped` / `order.pos_reverted`.
- **Important:** there is **no payment capture here** — no cash/card, no amount, no
  mark-as-paid. It is purely a "has this order been copied into the other till" tracker.

## 1.5 Options / variants — SHIPPED, end to end

- **Files:** `lib/db/schema/catalog.ts` (schema), `lib/catalog/*` (editor + validation),
  `lib/ordering/configurator.ts`, `lib/ordering/line-validation.ts`, `lib/catalog/storefront-dto.ts`,
  `lib/catalog/variant-option-overrides.ts`.
- **Data model:** `product_variants` (`price_override`, `is_default`,
  `option_max_selections_overrides`), `product_options` (`single_select`/`multi_select`,
  `required`, `min_select`, `max_select`), `option_values` (`price_addition`).
- **What it does today:** fully shipped, not stubbed. `placeOrder` (`actions.ts:128-190`) loads
  variants + options + values with pricing and validates each configured line
  (`validateConfiguredLine`), persisting per-line `options_json` on `order_items`. A
  tacos/shawarma-style configurable item renders, prices, and is captured into the order correctly.

## 1.6 Print pipeline + station routing — SHIPPED

- **Files:** `lib/printing/*` (`pipeline.ts`, `routing.ts`, `job-builder.ts`, `printers.ts`,
  `ticket.ts`, `kiosk.ts`), API `app/api/print/jobs/route.ts` + `[jobId]/printed` + `[jobId]/failed`.
- **Data model:** `printers` (station `counter`/`kitchen`/`bar`; connection
  `manual`/`escpos_lan`/`escpos_usb`/`webprint`), `print_jobs` queue (migration 0014),
  `category_print_routes` (migration `0019_print_station_routing.sql`).
- **What it does today:** print jobs are auto-enqueued on `placeOrder` (`actions.ts:254`,
  `enqueuePrintJobsForOrder`); a default counter printer is created if none exists. Routing is
  **category-based** (`routing.ts`): a category maps to stations; `counter` is always included; a
  category with no rows prints everywhere.
- **Relevance to KDS/POS:** this is a **physical-ticket** pipeline (ESC/POS or webprint). It is
  independent of the on-screen KDS — `KitchenBoard` reads orders straight from the DB, not from
  print jobs. Neither a screen-KDS nor a cashier POS *needs* this pipeline; it is parallel.

## 1.7 Cloture — SHIPPED, totals revenue only

- **Route:** `app/[locale]/(merchant)/cloture/page.tsx`; export API `app/api/cloture/export/route.ts`.
- **Files:** `lib/analytics/close-of-day-orders.ts`, `close-of-day-csv.ts`, `close-of-day-access.ts`,
  `close-of-day-export.ts`, `close-of-day.ts`. Access gated on the `close_of_day` permission
  (owner/manager/cashier).
- **What it totals today:** a per-business-day order list plus a totals row of `revenueMad` +
  `orderCount` (`close-of-day-csv.ts:79-91`).
- **CSV columns** (`CLOSE_CSV_HEADER`, `close-of-day-csv.ts:7-17`): Heure, Référence, Type, Table,
  Articles, Total (MAD), Statut, Téléphone, Note client.
- **The "Caisse" column** is appended **only when `posCoexistenceEnabled` is on**
  (`close-of-day-csv.ts:73,116-120`) and it holds the **POS-reconciliation status** ("À entrer" /
  "Entrée" / "Sautée"), **not** a cash/card amount.
- **Missing:** any payment-method breakdown (cash / card / Glovo) — because payment method is not
  modelled (see §3, step 6).

---

# 2. Entitlement gating for the order surfaces

- **Modules that exist** (`lib/entitlements/types.ts:1-6`): `menu_qr`, `online_ordering`,
  `loyalty`, `analytics`. There is **no** `pos`, `kitchen`, or `stock` module.
- **Merchant order list/detail** — `app/[locale]/(merchant)/orders/page.tsx`: wrapped in
  `<Gated module="online_ordering" businessId={business.id} …>` at **lines 32-36**. Gate key =
  **`online_ordering`**. (`(merchant)/layout.tsx:103-119` also reads `online_ordering` to decide
  nav visibility.)
- **Kitchen route** — `app/[locale]/kitchen/page.tsx` + `layout.tsx`: **no entitlement check at
  all.** Role-gated only (`owner`/`manager`/`kitchen`).
- **Cashier POS route** — **does not exist.** There is no dedicated POS route to gate. "POS" today
  is the reconciliation feature in §1.4, surfaced inside the `/orders` board.
- **Customer ordering** — storefront `app/[locale]/(storefront)/[slug]/order/page.tsx:27` checks
  `hasEntitlement(business.id, "online_ordering")`, and the `placeOrder` action re-checks it
  (`lib/ordering/actions.ts:116`). So customer ordering **is** gated on `online_ordering` — it is
  *not* "wide open." The audit's asymmetry claim does not hold on current `main`.
- **What `a60d8d9` grants** — `provisionDefaultEntitlements` (`lib/entitlements/defaults.ts`,
  called from `lib/business/actions.ts`) inserts `menu_qr` + `online_ordering`, `source: "trial"`,
  on business creation.
- **Does a default-onboarded business satisfy all three checks with zero data change?**
  **Yes.** Merchant `/orders` needs `online_ordering` ✓ (granted by default). Kitchen needs no
  entitlement ✓. Customer ordering needs `online_ordering` ✓ (granted by default). The gate key and
  the default-grant key are the same (`online_ordering`), so there is **nothing to configure** for
  Client 1 — confirming the scope's "entitle Client 1, change no code" plan, with the refinement
  that even the data change is already done by onboarding.

---

# 3. Re-baselined gap against `CLIENT_1_SCOPE.json`

### `core_loop` (7 steps)

| Step | Scope intent | Already on `main` | Genuinely missing | Nature of remaining work |
|---|---|---|---|---|
| 1 | Customer QR order → PENDING | storefront `/order` + `placeOrder` (`lib/ordering/actions.ts`) | — | **Works today** |
| 2 | Garçon confirms → CONFIRMED; POS auto-logs | `/orders` board "Confirmer" + `transitionOrderStatus` (`waiter` allowed); order is persisted from creation so it is *already* "logged" | A distinct cashier surface, *if* one is wanted | **Works today** (wire-only) |
| 3 | KDS, IN_KITCHEN | `app/[locale]/kitchen/*`, `preparing` = IN_KITCHEN | Per-dish **prep priority** | Add field + sorting (small net-new) |
| 4 | Kitchen marks READY → POS notified | `kitchenMarkReady`; `/orders` board polls via `OrdersPoller` | A dedicated POS screen to notify | Works at board level; net-new only if a POS screen is added |
| 5 | Garçon serves → SERVED | `markOrderServed` → `completed` | — | **Works today** |
| 6 | Cashier marks PAID (cash/card) | `payment_status` column exists, read-only | **Payment-method model + mark-paid action + cashier surface** | **Net-new build** |
| 7 | Cloture cash+card+Glovo | cloture totals revenue + order count | Payment-method split | Net-new (depends on step 6) |

### `current_state.gap` (the four claimed gaps)

1. **"garçon confirmation" — ALREADY SHIPPED.** `waiter` role + `pending → confirmed` transition +
   the `/orders` board "Confirmer" action. The scope overstated this.
2. **"KDS" — ALREADY SHIPPED**, except per-dish prep priority. The scope overstated this.
3. **"full cashier POS" — PARTIAL.** The order lifecycle, the `/orders` board, the role model, and
   order persistence all exist. Genuinely missing: **payment-method capture (cash/card/Glovo), a
   mark-paid action, and a cashier-facing surface.** Note: today's "POS" (§1.4) is *external-caisse
   reconciliation* — a different concept. A product decision is required (see changeset item 1).
4. **"recipe-based stock + supplier alerts" — genuinely net-new.** This is M3 and is **out of scope
   for this baseline** (see non-goals).

### Verdict

M1's end-to-end loop is **~70% already shipped**. The real M1 build is narrow and well-defined.

---

# M1 changeset list

Ordered by dependency. Concrete files; non-goals (stock/recipes/suppliers) excluded.

1. **Product decision — no code.** Resolve **POS coexistence vs. Quickarte-as-POS**: does the
   WDlink caisse remain the POS (keep `pos_status` reconciliation) or does Quickarte *become* the
   POS (payment captured in-app)? Items 2-5 below assume Quickarte-as-POS for Client 1. This must
   be settled before payment work starts.
2. **Payment-method data model** — new migration `lib/db/migrations/00XX_payment_method.sql` +
   `lib/db/schema/ordering.ts`: add a `payment_method` enum (`cash` | `card` | `glovo`) and column
   on `orders`. Decide here how Glovo is represented (a `payment_method` value, a new `channel`
   column, or an `order_type`) — recommend a dedicated `channel` so dine-in/Glovo stay orthogonal
   to how it was paid. Watch the existing `payment_mode` (`mad`/`credits`) — keep the two concepts
   distinct.
3. **`markOrderPaid` server action** — `lib/ordering/actions.ts`: add `markOrderPaid(orderId,
   method)` that sets `payment_status = 'paid'`, `paid_at`, and the method, records an
   `order_events` row, and gates on the **already-defined** `orders.mark_paid` permission
   (currently a dead permission — no action uses it).
4. **Cashier / POS surface** — extend `app/[locale]/(merchant)/orders/page.tsx` +
   `components/merchant/order-row.tsx` with pay actions and the "ready" notification, **or** add a
   dedicated POS route. (Re-using the `/orders` board is the lower-effort, no-over-engineering path.)
5. **Glovo one-tap logging** — a control on the cashier surface that creates a Glovo-channel order
   with the +30% markup applied and status straight to paid. New action (or `placeOrder` variant)
   + a Glovo-markup setting on `business_settings`.
6. **Prep priority** (independent — can run in parallel with 2-5) — migration adding
   `prep_priority` (integer) to `products` in `lib/db/schema/catalog.ts`; sorting in
   `lib/kitchen/queries.ts` (`getOpenKitchenOrders`) and `components/kitchen/kitchen-board.tsx`
   (`bucketOrders`); a manager edit control in `app/[locale]/(merchant)/catalog/*`.
7. **Cloture payment split** (depends on item 2) — `lib/analytics/close-of-day-orders.ts` +
   `close-of-day-csv.ts`: add cash / card / Glovo totals; surface them in
   `app/[locale]/(merchant)/cloture/page.tsx`.

---

# Noted, not fixed (per non-goal 1)

- `orders.mark_paid` is defined in the permission matrix (`lib/identity/permissions.ts`) but **no
  action references it** — `payment_status` is only ever read for display
  (`components/merchant/order-row.tsx:161`, storefront confirmation page). Payment is effectively
  unbuilt; orders sit at `unpaid` forever. (Resolved by changeset item 3.)
- Stripe vestiges remain after `cdf6cff` ripped active Stripe surfaces: `orders` still carries
  `stripe_payment_intent_id`, `stripe_charge_id`, `platform_fee_cents`, and a `stripe_events` table
  still exists (`lib/db/schema/ordering.ts:271-284`). Harmless, but dead weight — not M1's concern.
- `payment_mode` (`mad` / `credits`) already distinguishes loyalty-credit redemptions. Any new
  `payment_method` work must not collide with it — `payment_mode` = *what funded the order*,
  `payment_method` = *how cash/card was tendered*.

# Non-goals (explicit)

- This pass changed nothing. Anything found broken or half-built above is **noted, not fixed**.
- **No** schema or code design for stock, recipes, or suppliers — that is **M3**, out of scope for
  this baseline.
