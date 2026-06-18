# QuickArte — Customer-Only Strip-Down (status)

Branch: `client-1/m1-strip-customer-only` (off `client-1/m1-baseline-v2`).

QuickArte has been stripped to a **customer-facing storefront + the Mizane bridge**.
The merchant frontend and the backend that Mizane POS now owns are gone.

## What was done

- **Deleted route groups/routes:** `(merchant)`, `(auth)`, `(marketing)`, `kitchen`,
  `garcon`, `pos`, `print`, and the merchant API handlers (`api/print`, `api/cloture`,
  `api/check-slug`, `api/webhooks`).
- **Deleted lib modules:** `analytics, garcon, pos, kitchen, printing, push, merchant,
  growth, navigation, layout, business, loyalty` (+ `ordering/pos-reconciliation`,
  `ordering/journal-format`, `identity/staff-actions`).
- **Deleted components:** `merchant, auth, marketing, garcon, pos, kitchen, print,
  entitlements, places` (+ `ui/bottom-bar`, `ui/merchant-nav`).
- **Dropped QuickArte loyalty:** removed all loyalty UI/routes; removed accrual from
  `placeOrder` and `transitionOrder`; removed balance from the order tracker. Mizane
  attaches loyalty by phone on `POST /orders`.
- **Re-homed the Mizane status poll:** it used to fire from the (deleted) garcon snapshot.
  It now runs from the customer status endpoint `app/api/orders/[token]/status/route.ts`
  via `reconcileMizaneForCustomerToken(token)` in `lib/integrations/mizane/order-sync.ts`,
  gated by the existing 15s/business throttle.
- **`placeOrder` slimmed:** no more local printing / push notifications (Mizane owns those).
  It creates the order and forwards it to Mizane.

## Kept (customer surface + shared infra)

Routes: `/[locale]/[slug]` (menu), `/[slug]/order` (checkout), `/order/confirmation`,
`/[locale]/menu`, `/o/[token]` (tracker), `api/{auth,health,orders/[token],orders/[token]/status}`.

Lib: `integrations/mizane`, `ordering` (core), `catalog`, `db`, `entitlements`, `utils`,
`legal`, `auth` (Better Auth), `identity/permissions` (StaffRole + assertRole — shared infra).

Components: `storefront`, `legal`, `ui` (subset).

## Verified

- `npm run typecheck` → clean
- `npm test` → 241 pass / 0 fail
- `npx next build` → succeeds; route manifest is customer-only

## Behavior notes

- Mizane key is configured via env + `scripts/mizane-relink.ts` (no in-app config page).
  Menu sync is script-driven (`scripts/mizane-sync-test.ts`) — no in-app button.
- Without Mizane linked, orders land in QuickArte but stay `pending` (no merchant app to
  confirm). This is expected for the combined product.

## Done in the rewire session (2026-06-16)

1. **Menu sync completeness — DONE.** `getMizaneMenu` sends `If-None-Match` and returns a
   `{notModified}` result on 304; `syncMizaneMenu` caches the ETag on
   `mizane_integrations.menu_etag` (migration **0025**) and short-circuits on 304.
   Soft-delete: any mizane-linked catalog row absent from the response gets `deleted_at`
   set (scoped per business; local non-mizane rows untouched). The storefront read
   (`getMenuByBusinessId`) now filters `deleted_at IS NULL` at every level.
   *Live-verified: cold sync stores ETag, warm sync → `notModified`, phantom category soft-deleted.*
2. **Per-table QR — DONE.** `orders.mizane_table_id` (migration **0026**); a per-table QR
   deep-links `?t=<tableId>&tl=<label>`, plumbed through storefront → checkout → `placeOrder`;
   `postOrderToMizane` sends `tableId` and falls back to a counter order on `table-unknown`
   (stale QR). CLI: `scripts/mizane-table-qr.ts` (consumes `GET /tables`, writes QR PNGs).
   *Live-verified: table-unknown counter fallback. Cannot verify real tables — sandbox `GET /tables` is empty.*
3. **Status UX — DONE.** `postOrderToMizane` adopts Mizane's authoritative total onto
   `orders.total`; the tracker surfaces a cancellation as `Expirée` (auto-expiry →
   "commandez auprès du personnel") vs `Annulée` (staff reason shown), read from the
   `order.cancelled` event payload. *Live-verified: total adoption + all three cancel renderings.*

> Migrations 0025/0026 are registered in `meta/_journal.json` and have `scripts/apply-002{5,6}.ts`.

4. **Downstream status, full loop — DONE.** Mizane side (in the `mizan-pos` repo): `GET
   /v1/integration/orders/:id` now returns an additive `fulfillment` for confirmed orders
   (reuses the staff `deriveStatus`; non-breaking; api test 19/19). QuickArte side: the poll
   now scans all active statuses (not just `pending`) and maps `fulfillment` → the lifecycle
   (`in_progress→preparing`, `served→ready`, `paid/unpaid→completed`, `voided/refunded→cancelled`),
   advancing forward along valid transitions — so the customer tracker shows
   « En préparation / Prête / Servie ». Mapping in `lib/integrations/mizane/status-map.ts`
   (unit-tested); both repos **uncommitted**. *Live-verified the QuickArte advance against the DB;
   the live sandbox still runs old Mizane, so end-to-end `fulfillment` needs the Mizane change deployed.*

## Still to do

5. **Live-verify the confirmed/rejected/expired transitions** end-to-end: needs the enriched
   Mizane deployed + a staff confirm action (not on the integration key) or the 10-min auto-expiry.
6. **Cleanup (optional):** `lib/payments`, `lib/security`, `lib/catalog/actions.ts`, unused
   `components/ui/*` still compile but look unused; merchant tables remain in `lib/db/schema`
   (schema trim deliberately deferred — migration-risky, not needed for a working customer app).
