# Phase 0 Spec Amendments

This document is the authoritative source whenever `MVP_Feature_Spec_v1.md` and the locked Phase 0 decisions disagree.

Append any new contradictions found during M1-M9 using the same structure.

## Amendment 1 - Tenant Key

**Spec language:** Every entity carries a `restaurant_id` tenant key.

**Locked decision:** Tenant key is `business_id`, not `restaurant_id`.

**Authoritative rule:** Use `business_id` everywhere in code, schema, API contracts, generated SDKs, documentation, tests, and future writing. The spec text is wrong where it says `restaurant_id`.

**Phase 0 impact:** Multi-tenancy, RLS policies, JWT claims, seed data, API DTOs, and all new database tables must use `business_id`.

## Amendment 2 - Hosting Platform

**Spec language:** Cloud target is AWS or GCP in a Paris/Frankfurt region.

**Locked decision:** Hosting is Hetzner Falkenstein plus Coolify.

**Authoritative rule:** Treat the spec's AWS/GCP reference as informational only. Deployment targets Hetzner Falkenstein with Coolify, while the architecture remains cloud-agnostic.

**Phase 0 impact:** Docker, environment configuration, object storage choices, CI/CD, and deployment documentation must avoid Hetzner-specific application code or assumptions that would block a future move to another EU cloud.

## Amendment 3 - Auth Model

**Spec language:** API authentication is OAuth2 plus API keys per tenant.

**Locked decision:** Auth is Better Auth for web sessions plus a JWT extension for API and mobile clients.

**Authoritative rule:** Keep Better Auth for Quickarte web sessions. Extend or integrate JWT issuance for the new NestJS API, admin web, and POS terminal. The spec's OAuth2 plus tenant API key language is deferred.

**Phase 0 impact:** Tenant API keys are future work for third-party integrations, not Phase 0. If Better Auth cannot cleanly support the required JWT flow, M5 must surface options and wait for PM sign-off before any auth strategy swap.

## Amendment 4 - CMI and Offline Card Payments

**Spec language:** CMI card payment and offline card authorization are MVP requirements.

**Locked decision:** CMI and offline card payments are not implemented in Phase 0.

**Authoritative rule:** Phase 0 must support future CMI integration cleanly without implementing CMI itself. CMI implementation lands during Module 8, around month 6.

**Phase 0 impact:** Foundational architecture must not preclude CMI. Payment-related foundations should leave room for payment records, audit logging, offline sync, and idempotency keys, but no CMI gateway integration, tokenization flow, terminal workflow, or offline card authorization logic is built in Phase 0.

## Amendment 5 - Tenant Root Domain

**Spec language:** Tenant subdomains use `restaurantname.yourapp.ma`.

**Locked decision:** Tenant root domain is configurable via `TENANT_ROOT_DOMAIN`.

**Authoritative rule:** Do not hardcode a production tenant root domain in Phase 0. Development uses `*.lvh.me` or `*.localhost`. Production domain choice is deferred to launch and is not Phase 0 blocking.

**Phase 0 impact:** Subdomain parsing, documentation, tests, and deployment examples must use environment-driven domain configuration.

## Amendment 6 - On-Premise and Cloud Sync Boundary

**Spec language:** The spec describes cloud-hosted operation but also requires an offline-first POS foundation.

**Locked decision:** On-premise and cloud sync use the same API contract.

**Authoritative rule:** The only terminal-side difference between cloud-hosted tenants and premium on-premise tenants is the `API_BASE_URL` environment value. There is no tenant-specific client build.

**Phase 0 impact:** POS sync, generated SDK usage, environment configuration, and deployment documentation must keep the API contract identical across cloud and on-premise deployments.
