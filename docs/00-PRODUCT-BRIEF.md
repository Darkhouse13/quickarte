# Quickarte — Founding Product Brief

## Mission
Build a premium, minimalist, mobile-first commerce operating system for independent French boulangeries, cafés, and brunch spots — significantly better designed and easier to use than Sunday, Zelty, Innovorder, Lightspeed, or Square.

## Context
France has a dense, mature market of independent food merchants served by a crowded field of incumbents — Sunday (QR pay-at-table), Zelty and Innovorder (full POS suites), Lightspeed (enterprise POS), Square (hardware-first). Each solves part of the problem, but the tools feel dated, configuration-heavy, or bolted together. Owner-operated boulangeries and small cafés in Paris, Lyon, and Bordeaux routinely juggle two or three of them — a POS for the counter, a separate QR tool for tables, a third product for online orders — and still lack a calm, coherent view of their business. The wedge: one opinionated, beautifully designed tool that replaces the patchwork.

## Thesis
We do NOT want "another Zelty" or "another Sunday." We want a radically simpler, more premium, better-designed product — operationally powerful under the hood, with a calm, minimal frontend that a non-technical owner can run from a phone.

## Philosophy
- Powerful backend, very simple UI
- Opinionated workflows over settings
- Progressive disclosure
- Almost zero learning curve
- Elegant defaults, strong taste, very little clutter

## Design Taste
Clean, boxy, sharp brutalist aesthetic. Premium, calm, sharp, minimal, architectural, modern, high-contrast, serious. NOT playful, bubbly, generic SaaS, cluttered, or cheap POS.

Visual inspiration: Linear × Vercel × Stripe × Notion — adapted to independent French food merchants.

## Core User
Non-technical, owner-operated small business (boulangerie, café, brunch spot). Runs the counter and the back office from the same phone. Rarely sits at a desk.

## Primary Direction
Start with independent boulangeries and small cafés/brunch spots in Paris, Lyon, and Bordeaux as the wedge. Expand to adjacent food categories (cavistes, traiteurs, salons de thé) once the wedge is locked.

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
- Digital menu / storefront (EUR)
- QR menu page
- Online ordering + checkout
- Reservation request or table ordering
- Simple branded mini website

### Merchant-facing
- Onboarding wizard
- Catalog manager
- Order manager
- Analytics (sales by day/week, top items, order mix, peak hours — real module, not a toy chart)
- Loyalty (points or stamp card — simple, opinionated, owner-operated-friendly)
- Per-tenant feature entitlements — each merchant subscribes to a custom subset of modules (Menu+QR / Online Ordering / Loyalty / Analytics). Pricing is modular; UI reacts to the merchant's active entitlements.
- Payment configuration
- Business profile
- QR generation
- Basic promotions

### Backend Foundation
- Robust product/order/customer/business models
- Role-based access
- Audit logs
- Event tracking
- Localization-ready architecture (French only for v1)

## v1 Non-Goals
- Advanced CRM (segments, campaigns, lifecycle automation)
- Marketplace / aggregator features
- Deep accounting (journal entries, VAT declarations, export to accountant suites)
- Marketing automation (email/SMS drip, behavioral triggers)
- Multi-warehouse / inventory across locations
- Giant website builder
- Enterprise features (SSO, custom roles, SLAs)

## Top-Level Merchant Navigation
Accueil · Catalogue · Commandes · Fidélité   (+ Paramètres under user menu)

## Backend Domain Modules
Identity · Business · Catalog · Ordering · Payments · Loyalty · Analytics · Entitlements · Growth · Channels
