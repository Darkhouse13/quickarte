# 02 — Technical Direction

## Stack Decision

### Frontend (Merchant App + Customer Storefront)
- **Next.js 15** (App Router) — SSR for customer pages, fast merchant dashboard
- **TypeScript** — strict mode, no `any`
- **Tailwind CSS 4** — utility-first, matches our brutalist design system
- **Shadcn/ui** as base — will be heavily restyled to match Quickarte's sharp aesthetic
- **Zustand** for client state (lightweight, no boilerplate)
- **React Hook Form + Zod** for forms and validation

### Backend
- **Next.js API Routes + Server Actions** — no separate backend server in MVP
- **Drizzle ORM** — type-safe, lightweight, SQL-first
- **PostgreSQL** via Docker on Hetzner VPS (no managed DB cost in MVP)
- **Auth.js (NextAuth v5)** — phone/email magic link auth (no passwords in v1)
- **Cloudinary** — image uploads for menu items (free tier)

### Infrastructure
- **Coolify** (self-hosted on Hetzner VPS) — Docker-based PaaS, no vendor lock-in, ~€10/mo total
- **Hetzner** VPS (CX22 or CAX11) — EU datacenter (Falkenstein/Nuremberg — RGPD-friendly), excellent price/perf, ARM option available
- **Cloudflare** as DNS + CDN layer in front (free tier) — caching, DDoS, edge performance
- **PostgreSQL** running on the same VPS via Coolify (Docker) — no managed DB cost in MVP
- **Resend** for transactional email
- **Cloudinary** for image uploads (free tier covers MVP)
- **Next.js `standalone` output** — the deploy artifact is the standalone bundle inside a minimal Docker image; confirmed as the canonical build target for Coolify.

### Payments
- **Stripe as primary, both sides of the marketplace:**
  - **Stripe Connect** for customer → merchant order payments (Express or Standard accounts; onboarding inline from the merchant dashboard). Handles cards, Apple Pay, Google Pay, and SEPA where relevant.
  - **Stripe Billing** for merchant → Quickarte subscriptions. Each billable module (`menu_qr`, `online_ordering`, `loyalty`, `analytics`) maps to a Stripe Product with one or more Prices; a merchant's active subscription items drive their entitlements (see `04-PRICING-AND-ENTITLEMENTS.md`).
- **Cash orders** remain supported from day 1 — some boulangeries will run QR/online for menu display only and keep payment at the counter.
- **Payment abstraction layer** in code so checkout, refunds, and subscription sync don't hard-bind to Stripe's SDK shape. This is cheap insurance; we're not building a second provider in v1.
- **Future fallbacks (not v1):** Mollie (broader EU acquirer coverage, simpler pricing for some merchant profiles) and Lyra/PayZen (strong French acquirer relationships, useful for merchants with an existing BNP/CA/Société Générale contract). We will NOT build or maintain a second provider in v1 — the abstraction exists to keep the option open, not to ship two integrations.

#### RGPD / GDPR Readiness (v1 Requirements)
France-native means RGPD-native. These are v1 blockers, not nice-to-haves:
- **Cookie and tracker consent** — a compliant banner (CNIL-aligned) before any non-essential cookie or third-party script fires. Analytics, marketing pixels, and session replay are all gated on explicit consent.
- **No third-party trackers without consent** — no Google Analytics, Meta Pixel, or similar loaded by default. First-party, server-side analytics for our own product telemetry.
- **Data export endpoint** — a merchant (and, where applicable, an end customer) can request a machine-readable export of their data. Initial implementation can be a signed, async job that emails a download link.
- **Data deletion endpoint** — a merchant can trigger account and business deletion; we hard-delete or anonymize per a documented retention policy. Orders are retained for legal accounting minima (10 years in France) in an anonymized form.
- **Privacy policy page** — public `/politique-de-confidentialite` page, kept in sync with what we actually do. Linked from footer and signup.
- **DPA / sub-processor list** — a short, public list of sub-processors (Stripe, Cloudinary, Resend, Hetzner, Cloudflare) with their roles and locations.
- **Data residency** — all primary data in EU (Hetzner Germany). No US-region services in the hot path.

#### Hosting Decision Rationale
We evaluated two alternatives to Vercel:

**Coolify + Hetzner (chosen):**
- Standard Node.js runtime — zero compatibility concerns with Next.js 15 standalone output
- PostgreSQL runs alongside the app on the same server — no external DB cost
- Docker-based — trivial to add Redis, MinIO, or any service later
- Full control, no vendor lock-in, predictable cost (~€10/mo)
- EU data residency by default — RGPD-aligned
- Cloudflare CDN in front gives us edge caching for free

**Cloudflare Workers (rejected for now):**
- Next.js runs via OpenNext adapter — improved but still has edge cases
- Worker size limits (3MB free, 10MB paid) could become a constraint
- No native PostgreSQL — would need external DB (adds cost + latency)
- Edge runtime quirks could slow development velocity
- Good option to revisit if we need global edge performance later

### Monorepo Structure
Single Next.js app with clear internal module boundaries — NOT a monorepo with multiple packages. Keep it simple.

## Architecture Principles
- Server Components by default, Client Components only when interactive
- All business logic in `/lib/` domain modules, not scattered in components
- Database schema mirrors domain modules: identity, business, catalog, ordering, payments, entitlements, loyalty, analytics
- API layer is thin — server actions for mutations, server components for reads
- Feature flags via simple env vars (no feature flag service in v1)
- i18n scaffolding in place (next-intl), French as the only active locale for v1
- Entitlement checks are centralized — no ad-hoc `if (business.hasLoyalty)` in components; a single `hasEntitlement(businessId, module)` helper

## Project Structure
```
quickarte/
├── app/
│   ├── [locale]/
│   │   ├── (merchant)/      # Merchant dashboard (authed)
│   │   │   ├── home/
│   │   │   ├── catalog/
│   │   │   ├── orders/
│   │   │   ├── customers/
│   │   │   └── store/
│   │   ├── (storefront)/    # Customer-facing pages (public)
│   │   │   ├── [slug]/      # Business storefront
│   │   │   └── menu/
│   │   ├── (auth)/          # Login, onboarding
│   │   └── layout.tsx
│   └── api/
├── components/
│   ├── ui/                  # Design system primitives
│   ├── merchant/            # Merchant dashboard components
│   └── storefront/          # Customer-facing components
├── lib/
│   ├── db/
│   │   ├── schema/          # Drizzle schema files per domain
│   │   └── migrations/
│   ├── identity/            # Auth, users, roles
│   ├── business/            # Business profiles, settings
│   ├── catalog/             # Products, categories, variants
│   ├── ordering/            # Orders, carts, checkout
│   ├── payments/            # Stripe Connect + Billing, payment abstraction
│   ├── entitlements/        # Module entitlement checks, sync from Stripe Billing
│   ├── loyalty/             # Points / stamp card logic
│   ├── analytics/           # Aggregations, charts data
│   └── utils/
├── messages/                # i18n translation files (fr active; ar retained but unused — to be removed in a later pass)
│   ├── fr.json
│   └── ar.json
├── public/
├── drizzle.config.ts
├── tailwind.config.ts
├── next.config.ts
├── Dockerfile
├── docker-compose.yml       # PostgreSQL + app for local dev
├── .env.example
└── package.json
```

## Data Model (Core Entities)

### Identity
- `users` — id, phone, email, name, role, created_at
- `sessions` — standard auth sessions

### Business
- `businesses` — id, owner_id, name, slug, type (boulangerie|cafe|brunch|restaurant), logo, cover, currency (default EUR), timezone, locale (default fr-FR), created_at
- `business_settings` — business_id, ordering_enabled, reservations_enabled, etc.

### Catalog
- `categories` — id, business_id, name, position, visible
- `products` — id, business_id, category_id, name, description, price, image, available, position
- `product_variants` — id, product_id, name, price_override
- `product_options` — id, product_id, name, type (single_select|multi_select), required
- `option_values` — id, option_id, name, price_addition

### Ordering
- `orders` — id, business_id, customer_name, customer_phone, type (dine_in|takeaway|click_and_collect), status, total, notes, table_number, created_at
- `order_items` — id, order_id, product_id, quantity, unit_price, options_json, subtotal
- `reservations` — id, business_id, customer_name, customer_phone, date, time, party_size, status, notes

### Payments (Stripe-backed)
- `payment_accounts` — business_id, stripe_account_id, charges_enabled, payouts_enabled, onboarding_status
- `payment_intents` — id, order_id, stripe_payment_intent_id, status, amount, currency

### Entitlements & Billing
- `business_entitlements` — business_id, module, enabled, plan_tier, valid_until (see `04-PRICING-AND-ENTITLEMENTS.md` for the full model)
- `billing_subscriptions` — business_id, stripe_customer_id, stripe_subscription_id, status

### Loyalty
- `loyalty_programs` — business_id, type (points|stamp), config_json, active
- `loyalty_members` — business_id, customer_phone, balance, last_activity_at

### Analytics
- Aggregations computed on read from `orders` / `order_items`; a lightweight `analytics_daily_snapshots` table can be introduced if read cost grows.

### Growth
- `promo_codes` — id, business_id, code, discount_type, discount_value, active, expires_at

## What We Defer
- Second payment provider (Mollie / Lyra) — abstraction only in v1
- Customer accounts (ordering is guest-first in v1; loyalty keys off phone number)
- Staff/roles beyond owner (single-user in v1)
- Multi-location (data model supports it via business_id, but UI is single-business)
- Arabic locale — retained on disk to avoid breaking the build now; will be removed in a dedicated pass
