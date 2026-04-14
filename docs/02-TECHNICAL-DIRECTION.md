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
- **Hetzner** VPS (CX22 or CAX11) — EU datacenter, excellent price/perf, ARM option available
- **Cloudflare** as DNS + CDN layer in front (free tier) — caching, DDoS, edge performance
- **PostgreSQL** running on the same VPS via Coolify (Docker) — no managed DB cost in MVP
- **Resend** for transactional email
- **Cloudinary** for image uploads (free tier covers MVP)

### Payments (deferred from v1, architecture-ready)
- **Cash orders** supported from day 1 — this is essential for Morocco where cash dominates
- **YouCan Pay** as primary gateway when we add online payments — Morocco-native, developer-friendly JS SDK + Node SDK, supports fr/ar/en, sandbox mode, tokenization flow
- **CMI** (Centre Monétique Interbancaire) as secondary/future option — dominant in Morocco, all Visa/Mastercard + local cards, but clunkier API and heavier merchant onboarding paperwork
- **Stripe is NOT available in Morocco** — explicitly excluded from the stack
- Payment abstraction layer in code so we can swap providers without rewriting checkout

#### Hosting Decision Rationale
We evaluated two alternatives to Vercel:

**Coolify + Hetzner (chosen):**
- Standard Node.js runtime — zero compatibility concerns with Next.js 15
- PostgreSQL runs alongside the app on the same server — no external DB cost
- Docker-based — trivial to add Redis, MinIO, or any service later
- Full control, no vendor lock-in, predictable cost (~€10/mo)
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
- Database schema mirrors domain modules: identity, business, catalog, ordering
- API layer is thin — server actions for mutations, server components for reads
- Feature flags via simple env vars (no feature flag service in v1)
- i18n-ready from day 1 (next-intl), French as default locale

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
│   └── utils/
├── messages/                # i18n translation files
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
- `businesses` — id, owner_id, name, slug, type (restaurant|cafe|retail), logo, cover, currency, timezone, locale, created_at
- `business_settings` — business_id, ordering_enabled, reservations_enabled, etc.

### Catalog
- `categories` — id, business_id, name, position, visible
- `products` — id, business_id, category_id, name, description, price, image, available, position
- `product_variants` — id, product_id, name, price_override
- `product_options` — id, product_id, name, type (single_select|multi_select), required
- `option_values` — id, option_id, name, price_addition

### Ordering
- `orders` — id, business_id, customer_name, customer_phone, type (dine_in|takeaway|delivery), status, total, notes, table_number, created_at
- `order_items` — id, order_id, product_id, quantity, unit_price, options_json, subtotal
- `reservations` — id, business_id, customer_name, customer_phone, date, time, party_size, status, notes

### Growth
- `promo_codes` — id, business_id, code, discount_type, discount_value, active, expires_at

## What We Defer
- Payments table (until YouCan Pay / CMI integration)
- Customer accounts (ordering is guest-first in v1)
- Analytics tables (use event tracking, compute on read)
- Staff/roles beyond owner (single-user in v1)
- Multi-location (data model supports it via business_id, but UI is single-business)
