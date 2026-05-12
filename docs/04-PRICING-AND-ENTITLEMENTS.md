# 04 — Pricing and Entitlements

## 1. Principle

Quickarte is sold as a set of independently priced modules. A merchant only pays for what they turn on. This is both a pricing advantage (lower effective price vs. bundled incumbents) and a product constraint (each module must stand on its own; no module may hard-depend on another unrelated module).

Concretely: a boulangerie that only wants a QR menu pays for `menu_qr` and nothing else. A brunch café that wants the full stack subscribes to all four. The UI, the manual activation process, and the backend all reflect this reality.

---

## 2. The Four Billable Modules

Each module is identified by a stable string slug. These slugs are used in the database and in entitlement checks.

### `menu_qr`
Digital menu, QR menu page, branded mini-storefront, catalog manager. The entry-level module — what a merchant gets when they just want their menu online and a QR code on each table.

### `online_ordering`
Click-and-collect and in-store ordering flow: cart, checkout, order manager, order-status notifications. Quickarte does not process payment; orders are captured and the merchant settles payment with the customer out-of-band. "À régler sur place" is the only payment path.

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
| `source`      | enum(`manual`,`trial`)                | Where the entitlement came from. Lets us distinguish hand-granted and trial rows.    |
| `updated_at`  | timestamptz                           | Last time we updated this row.                                                       |

Primary key: `(business_id, module)`.

**Why not a JSON blob on `businesses`:** we want to query "who has loyalty enabled" efficiently, we want per-module history, and we want individual entitlement rows to be changed without rewriting the whole business record.

**Companion tables** (already referenced in `02-TECHNICAL-DIRECTION.md`):
- `payment_accounts`: schema-only dead weight; not read or written in v1.

*(Migration is NOT written yet. This section is design only.)*

---

## 4. Entitlement Check Semantics

A single helper, conceptually `hasEntitlement(businessId, module)`, is the only way code reads entitlement state. Rules:

1. A row with `enabled = true` and (`valid_until IS NULL OR valid_until > now()`) grants access.
2. Absence of a row is equivalent to `enabled = false`.
3. `source = 'trial'` and `source = 'manual'` are treated identically for access purposes — trials differ only in how they are created and expired.
4. Entitlement checks happen **server-side**. The client may receive a pre-computed list of active modules for rendering, but never makes authorization decisions on its own.

The `business_entitlements` table is the source of truth. Mutations happen via the admin CLI (`npm run entitlements -- grant`) or a small admin UI; there is no external webhook driving entitlement state.

---

## 5. UI Behavior for Missing Entitlements

A missing entitlement is **never an error**. It is a gated surface with a soft, respectful upsell.

**Navigation:**
- Modules the merchant has access to appear in the main nav as normal.
- Modules they don't have access to are either hidden entirely (default for a brand-new business) or shown in a dimmed "discover" state (for established businesses we're cross-selling to). The choice is per-module and can be tuned without code changes.

**Attempted access (deep link, old bookmark, marketing link):**
- The merchant lands on a **module landing page** — a calm, branded screen that explains what the module does, shows one or two screenshots, and offers a primary action ("Activer ce module"). No 404, no "forbidden", no red error banner.
- The CTA opens a contact form or mailto:hello@quickarte.fr. Activation is processed manually during the pilot phase; a self-serve activation UI is post-pilot.
- After a manual grant, the merchant refreshes and the now-unlocked module appears.

**In-module upsells (from an adjacent surface):**
- Example: a merchant has `online_ordering` but not `loyalty`. On the order confirmation screen, there's a single, understated line — "Fidélisez ce client en activant le module Loyalty" — that links to the loyalty landing page. One line, one link, no modal, no badge.

**Tone:**
- Never punitive. Never "upgrade to unlock." Always "activer" or "ajouter ce module" — additive language, not gated-feature language.

---

## 6. Pricing

**Pricing is TBD and will be set per-deal during the early door-to-door phase.**

All prices, when locked, are MAD-denominated.

Do NOT hardcode prices in the codebase, in copy, in emails, or in seed scripts. Product/module prices will be tracked manually during early sales, or via a small admin tool — not committed to source.

Quickarte charges merchants a flat subscription, priced per-deal during the pilot phase. Pricing is modular — each module (`menu_qr`, `online_ordering`, `loyalty`, `analytics`) has its own contribution to the total. Quickarte does **not** take any percentage of order revenue and does **not** process customer-to-merchant payments. Merchants settle orders out-of-band with customers.

When we lock a public price list, this section will be updated with the authoritative table and the admin flow will be retired in favor of a standard activation process.

---

## 7. Open Questions (Not Blockers for v1 Docs)

- Trial mechanics: do we offer a universal 30-day trial on all modules, or trial only `menu_qr` and charge from day 1 on the others? (Leaning: 30-day trial on `menu_qr`, immediate billing on the rest, revisit after 20 merchants.)
- Annual vs. monthly: monthly-only to start. Annual with discount once pricing stabilizes.
- Downgrades: what happens to a merchant's loyalty data when they drop `loyalty`? Default: data retained, UI gated. Re-enabling restores full access. Delete only on explicit request under Loi 09-08 / CNDP handling.
