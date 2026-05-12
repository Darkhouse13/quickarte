# Quickarte — Founding Product Brief

## Mission
Build a premium, minimalist, mobile-first commerce operating system for independent Moroccan fast-food restaurants and cafés in Casablanca, Rabat, Marrakech, and Tangier.

## Context
Morocco's urban food merchants are digitizing from the outside in: Instagram drives discovery, WhatsApp handles pre-orders, QR codes are familiar after COVID, and many owner-operated shops still run their daily operation through a patchwork of phone calls, legacy POS, spreadsheets, paper notes, and unbranded online-menu builders. Feadys is the primary direct competitor reference; the wider competitive set is still thin and uneven.

Fast-food restaurants and cafés are the right wedge because they have a visible customer journey, high repeat traffic, and immediate operational pain around menus, order capture, and loyalty. French tacos, shawarmas, pizzas, kebabs, patata asada, paninis, burgers, fries, petits déjeuners, snacks, pâtisseries, coffee, and tea all fit the same need: a branded storefront and operating workspace that is simple enough to run from a phone. French tacos and shawarmas are heavily configured at order time, so product options and variants must be first-class in the ordering experience, not an afterthought.

The wedge is not to become a payments processor or a full POS replacement. The wedge is one opinionated, beautifully designed tool that lets a merchant publish a branded menu, capture orders, manage loyalty, and understand the week without stitching together ad-hoc tools.

## Thesis
We do NOT want "another legacy POS" or "another generic QR menu builder." We want a radically simpler, more premium, better-designed product — operationally powerful under the hood, with a calm, minimal frontend that a non-technical owner can run from a phone.

## Philosophy
- Powerful backend, very simple UI
- Opinionated workflows over settings
- Progressive disclosure
- Almost zero learning curve
- Elegant defaults, strong taste, very little clutter

## Design Taste
Clean, boxy, sharp brutalist aesthetic. Premium, calm, sharp, minimal, architectural, modern, high-contrast, serious. NOT playful, bubbly, generic SaaS, cluttered, or cheap POS.

Visual inspiration: Linear × Vercel × Stripe × Notion — adapted to independent food merchants.

## Core User
Non-technical, owner-operated fast-food restaurant owner or café manager. Runs the counter, order flow, catalog, and back office from the same phone. Rarely sits at a desk, and needs the system to work during service without becoming another screen to manage.

## Primary Direction
Start with independent fast-food restaurants and cafés in Casablanca, Rabat, Marrakech, and Tangier as the wedge. Expand to adjacent independent restaurant formats once the pilot proves the operating loop.

## Product Principles
- Create before configure
- Instant first value
- Progressive complexity
- One-screen-first design
- No settings jungle, no feature soup
- Every screen useful immediately
- Surface only what matters now
- Workflows outcome-oriented, not system-oriented

## MVP Scope

### Customer-facing
- Digital menu / storefront (MAD)
- QR menu page
- Online ordering + checkout for order capture only
- Product options & variants (size / sauces / toppings / meat choice) — first-class in the customer-facing ordering flow
- "À régler sur place" as the only payment path
- Reservation request or table ordering
- Simple branded mini website

### Merchant-facing
- Onboarding wizard
- Catalog manager
- Order manager
- Analytics (sales by day/week, top items, order mix, peak hours — real module, not a toy chart)
- Loyalty (points or stamp card — simple, opinionated, owner-operated-friendly)
- Per-tenant feature entitlements — each merchant subscribes to a custom subset of modules (Menu+QR / Online Ordering / Loyalty / Analytics). Pricing is modular, MAD-denominated when locked; UI reacts to the merchant's active entitlements.
- Out-of-band settlement instructions
- Business profile
- QR generation
- Basic promotions

### Backend Foundation
- Robust product/order/customer/business models
- Role-based access
- Audit logs
- Event tracking
- Localization-ready architecture (French (fr-MA) active; Arabic scaffolding retained, surfaced post-pilot)
- Timezone default: Africa/Casablanca

## v1 Non-Goals
- Customer-facing payment processing
- Advanced CRM (segments, campaigns, lifecycle automation)
- Marketplace / aggregator features
- Deep accounting (journal entries, TVA declarations, export to accountant suites)
- Marketing automation (email/SMS drip, behavioral triggers)
- Multi-warehouse / inventory across locations
- Giant website builder
- Enterprise features (SSO, custom roles, SLAs)

## Top-Level Merchant Navigation
Accueil · Catalogue · Commandes · Fidélité   (+ Paramètres under user menu)

## Backend Domain Modules
Identity · Business · Catalog · Ordering · Payments · Loyalty · Analytics · Entitlements · Growth · Channels
