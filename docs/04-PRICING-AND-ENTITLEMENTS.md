# 04 — Pricing and Entitlements

## 1. Principle

Quickarte is sold as a set of independently priced modules. A merchant only pays for what they turn on. This is both a pricing advantage (lower effective price vs. bundled incumbents) and a product constraint (each module must stand on its own; no module may hard-depend on another unrelated module).

Concretely: a boulangerie that only wants a QR menu pays for `menu_qr` and nothing else. A brunch café that wants the full stack subscribes to all four. The UI, the billing, and the backend all reflect this reality.

---

## 2. The Four Billable Modules

Each module is identified by a stable string slug. These slugs are used in the database, in Stripe Billing metadata, and in entitlement checks.

### `menu_qr`
Digital menu, QR menu page, branded mini-storefront, catalog manager. The entry-level module — what a merchant gets when they just want their menu online and a QR code on each table.

### `online_ordering`
Click-and-collect and in-store ordering flow: cart, checkout, order manager, payment collection via Stripe Connect, order-status notifications. Requires a Stripe Connect account to be fully functional; cash-only fallback is still supported for merchants who enable this module but haven't finished Connect onboarding.

### `loyalty`
Stamp card or points program, customer enrollment (phone-number-keyed), reward redemption at checkout, basic member view. Opinionated: one program type per business, a small set of presets, no campaign engine.

### `analytics`
Sales by day/week/month, top items, order mix (dine-in vs. click-and-collect), peak hours, customer retention snapshot. Real analytics — not a toy chart. Fed primarily from `orders` and `loyalty_members`.

---

## 3. Data Model (Description Only — No Migration Yet)

The source of truth for what a merchant has access to is a `business_entitlements` table. One row per business per module.

**`business_entitlements`** — conceptual shape:

| Column        | Type                                  | Notes                                                                                |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `business_id` | fk → `businesses.id`                  | Scope key.                                                                           |
| `module`      | enum(`menu_qr`,`online_ordering`,`loyalty`,`analytics`) | Module slug. Composite PK with `business_id`.                  |
| `enabled`     | boolean                               | Active flag. Soft off instead of row delete, so history is preserved.                |
| `plan_tier`   | text (nullable)                       | Free-form tier label (`"starter"`, `"pro"`, etc.). Nullable for simple on/off modules. |
| `valid_until` | timestamptz (nullable)                | When the entitlement lapses. Null = open-ended (useful for manual overrides, trials, early-deal merchants). |
| `source`      | enum(`stripe`,`manual`,`trial`)       | Where the entitlement came from. Lets us distinguish paying, hand-granted, and trial rows. |
| `updated_at`  | timestamptz                           | Last time we synced this row.                                                         |

Primary key: `(business_id, module)`.

**Why not a JSON blob on `businesses`:** we want to query "who has loyalty enabled" efficiently, we want per-module history, and we want to sync individual rows from Stripe webhooks without rewriting the whole business record.

**Companion tables** (already referenced in `02-TECHNICAL-DIRECTION.md`):
- `billing_subscriptions` — links a business to its Stripe customer + subscription. The Stripe subscription's items are the authoritative source that drives entitlements; Stripe webhooks write to `business_entitlements`.
- `payment_accounts` — Stripe Connect account state for the merchant, used by `online_ordering`.

*(Migration is NOT written yet. This section is design only.)*

---

## 4. Entitlement Check Semantics

A single helper, conceptually `hasEntitlement(businessId, module)`, is the only way code reads entitlement state. Rules:

1. A row with `enabled = true` and (`valid_until IS NULL OR valid_until > now()`) grants access.
2. Absence of a row is equivalent to `enabled = false`.
3. `source = 'trial'` is treated identically to `source = 'stripe'` for access purposes — trials differ only in how they're created and expired.
4. Entitlement checks happen **server-side**. The client may receive a pre-computed list of active modules for rendering, but never makes authorization decisions on its own.

No business logic ever uses `subscription.status === 'active'` directly. The subscription → entitlement mapping lives in one place (a Stripe webhook handler plus a reconciliation job); everything else reads `business_entitlements`.

---

## 5. UI Behavior for Missing Entitlements

A missing entitlement is **never an error**. It is a gated surface with a soft, respectful upsell.

**Navigation:**
- Modules the merchant has access to appear in the main nav as normal.
- Modules they don't have access to are either hidden entirely (default for a brand-new business) or shown in a dimmed "discover" state (for established businesses we're cross-selling to). The choice is per-module and can be tuned without code changes.

**Attempted access (deep link, old bookmark, marketing link):**
- The merchant lands on a **module landing page** — a calm, branded screen that explains what the module does, shows one or two screenshots, and offers a primary action ("Activer ce module"). No 404, no "forbidden", no red error banner.
- The CTA opens the Stripe Billing portal (or an in-app module-picker that creates a Billing session) so the merchant can add it to their subscription in one step.
- After activation, the webhook flips the entitlement row and the merchant is redirected back to the now-unlocked module.

**In-module upsells (from an adjacent surface):**
- Example: a merchant has `online_ordering` but not `loyalty`. On the order confirmation screen, there's a single, understated line — "Fidélisez ce client en activant le module Loyalty" — that links to the loyalty landing page. One line, one link, no modal, no badge.

**Tone:**
- Never punitive. Never "upgrade to unlock." Always "activer" or "ajouter ce module" — additive language, not gated-feature language.

---

## 6. Pricing

**Pricing is TBD and will be set per-deal during the early door-to-door phase.**

Do NOT hardcode prices in the codebase, in copy, in emails, or in Stripe seed scripts. Stripe Billing Products will exist for each module, but their Prices will be created manually per merchant during early sales, or via a small admin tool — not committed to source.

When we lock a public price list, this section will be updated with the authoritative table and the admin flow will be retired in favor of standard Prices.

---

## 7. Revenue model

**Revenue model.** Quickarte charges merchants a flat monthly subscription, priced per-deal during the early door-to-door phase. Pricing is modular — each module (`menu_qr`, `online_ordering`, `loyalty`, `analytics`) has its own contribution to the total. Quickarte does **not** take any percentage of order revenue. Merchants who enable online ordering via Stripe Connect receive 100% of customer payments directly into their own Stripe account (minus Stripe's own processing fees, which are between the merchant and Stripe). This is a deliberate positioning choice against commission-based platforms (Uber Eats, Deliveroo, Just Eat) where merchants lose 20–30% per order.

**Implementation status.** Subscription billing is currently manual — entitlements are granted via CLI after a per-deal handshake, and merchants are invoiced separately (SEPA, bank transfer, or Stripe invoice link from the Quickarte team account). Stripe Billing will be wired once we have stable price points validated across 3–5 merchants. Until then, manual invoicing is intentional — it forces real pricing conversations.

---

## 8. Open Questions (Not Blockers for v1 Docs)

- Trial mechanics: do we offer a universal 30-day trial on all modules, or trial only `menu_qr` and charge from day 1 on the others? (Leaning: 30-day trial on `menu_qr`, immediate billing on the rest, revisit after 20 merchants.)
- Annual vs. monthly: monthly-only to start. Annual with discount once pricing stabilizes.
- Downgrades: what happens to a merchant's loyalty data when they drop `loyalty`? Default: data retained, UI gated. Re-enabling restores full access. Delete only on explicit request (RGPD).
- Promo codes on subscriptions: Stripe Coupons are fine; do not build a parallel system.
