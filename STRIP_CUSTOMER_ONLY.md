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

## Still to do (from the finalization brief)

1. **Menu sync completeness:** ETag/304 conditional fetch + soft-delete entities removed from Mizane.
2. **Per-table QR:** generate per-table QR codes deep-linking Mizane's `tableId` (consume `GET /tables`).
3. **Status UX:** show Mizane's authoritative order total; handle `rejected`/`expired` cleanly.
4. **Mizane-side (additive, we have WRITE):** enrich `GET /v1/integration/orders/:id` to read
   through `online_pending_orders.confirmedOrderId` and surface downstream ready/paid.
5. **Cleanup (optional):** `lib/payments`, `lib/security`, `lib/catalog/actions.ts`, unused
   `components/ui/*` still compile but look unused; merchant tables remain in `lib/db/schema`
   (schema trim deliberately deferred — migration-risky, not needed for a working customer app).

## Prompt for the next session

> Read `MIZANE_QUICKARTE_FINALIZATION.md`, `STRIP_CUSTOMER_ONLY.md`, and
> `QUICKARTE_SANDBOX_HANDOFF.md`. The strip-down to customer-only is done and the app builds
> (branch `client-1/m1-strip-customer-only`). Now do the "rewire" work, smallest-risk first:
> (1) live-verify the re-homed Mizane poll against the sandbox (place an order, confirm/reject
> it staff-side, watch `/api/orders/[token]/status` reconcile); (2) add ETag/304 + soft-delete
> to menu sync; (3) surface Mizane's authoritative total + rejected/expired UX on the tracker;
> (4) per-table QR → Mizane `tableId`. Keep it simple — no over-engineering. Verify with
> `npm run typecheck`, `npm test`, and `npx next build` after each change.
