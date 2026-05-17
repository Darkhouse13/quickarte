# Phase 0 Verification Checklist

Legend: `✓` done, `⚠` partial/deferred with documented path, `✗` not done.

## 0.1 Tech Stack

| Requirement | Status | Evidence |
|---|---:|---|
| Monorepo with pnpm workspaces and Turborepo | ✓ | `package.json`, `pnpm-workspace.yaml`, `turbo.json` |
| Backend uses NestJS and TypeScript | ✓ | `apps/api/package.json`, `apps/api/src/main.ts` |
| PostgreSQL database with Drizzle schema | ✓ | `packages/db-schema`, `packages/db-schema/drizzle.config.ts` |
| Redis available for auth/rate-limit foundation | ✓ | `docker-compose.yml`, `apps/api/src/auth/rate-limit.service.ts` |
| React + TypeScript admin web via Vite SPA | ✓ | `apps/admin-web/package.json`, `apps/admin-web/vite.config.ts` |
| React Native POS terminal via Expo | ✓ | `apps/pos-terminal/package.json`, `apps/pos-terminal/app.json` |
| Local SQLite via WatermelonDB | ✓ | `apps/pos-terminal/src/db/schema.ts`, `apps/pos-terminal/src/db/index.ts` |
| OpenAPI 3 + generated SDK | ✓ | `apps/api/src/openapi.ts`, `packages/shared-types/src/api.ts` |
| GitHub Actions CI/CD baseline | ✓ | `.github/workflows/ci.yml` |
| Hetzner/Coolify documented, cloud-agnostic app code | ✓ | `docs/phase-0/DEPLOYMENT.md`, `docs/phase-0/SPEC_AMENDMENTS.md` |

## 0.2 Multi-Tenant Architecture

| Requirement | Status | Evidence |
|---|---:|---|
| Tenant key is `business_id` | ✓ | `docs/phase-0/SPEC_AMENDMENTS.md`, JWT claims in `apps/api/src/auth/jwt.strategy.ts` |
| API sets transaction-scoped tenant context | ✓ | `apps/api/src/database/database.service.ts` |
| RLS on new API-owned tenanted tables | ✓ | `packages/db-schema/migrations/0022_enable_rls.sql`, `0023_auth_rbac.sql` |
| Strict fail-closed RLS policy pattern documented | ✓ | `docs/phase-0/RLS_ROLLOUT_PLAN.md` |
| Quickarte-shared table RLS rollout documented | ⚠ | Deferred until Quickarte DB access is tenant-scoped; see `docs/phase-0/RLS_ROLLOUT_PLAN.md` |
| Subdomain routing strategy documented | ✓ | `docs/phase-0/SUBDOMAIN_ROUTING.md` |
| Super-admin pattern selected | ⚠ | Pattern A recommended and documented; implementation deferred; see `docs/phase-0/SUPER_ADMIN_DECISION.md` |

## 0.3 API-First Design

| Requirement | Status | Evidence |
|---|---:|---|
| Versioned REST API under `/v1` | ✓ | `apps/api/src/main.ts` |
| OpenAPI generated automatically | ✓ | `apps/api/scripts/generate-openapi.ts` |
| Swagger UI/docs exposed | ✓ | `apps/api/src/openapi.ts` |
| Shared TypeScript SDK generated | ✓ | `packages/shared-types/src/api.ts` |
| Admin web consumes generated SDK | ✓ | `apps/admin-web/src/auth/api.ts`, `apps/admin-web/src/pages/DashboardPage.tsx` |
| POS terminal consumes generated SDK | ✓ | `apps/pos-terminal/src/api/client.ts` |
| No new business feature logic in UI layer | ✓ | Phase 0 added shells/foundations only; feature modules deferred |
| Quickarte still uses existing Server Actions | ⚠ | Intentional per Phase 0 rule; future Module 13 integration refactors QR app API consumption |

## 0.4 Offline-First Foundation

| Requirement | Status | Evidence |
|---|---:|---|
| POS local DB schema exists | ✓ | `apps/pos-terminal/src/db/schema.ts` |
| WatermelonDB adapter and singleton database exist | ✓ | `apps/pos-terminal/src/db/index.ts` |
| Outbox table exists | ✓ | `apps/pos-terminal/src/db/schema.ts` |
| Sync metadata exists | ✓ | `apps/pos-terminal/src/db/schema.ts` |
| Pull/push sync engine skeleton exists | ✓ | `apps/pos-terminal/src/sync/engine.ts` |
| Server sync endpoints exist | ✓ | `apps/api/src/sync/sync.controller.ts`, `apps/api/src/sync/sync.service.ts` |
| Server-timestamp-wins helper exists | ✓ | `apps/pos-terminal/src/sync/conflict.ts` |
| Offline indicator exists | ✓ | `apps/pos-terminal/src/components/SyncStatusIndicator.tsx` |
| Full feature-table sync coverage | ⚠ | Foundation only: M6 pulls `businesses`/`staff_members`, pushes `audit_log`; feature modules add tables |
| Real-device offline smoke | ⚠ | Deferred to pre-pilot; see `docs/phase-0/POS_SMOKE_TEST_RESULT.md` |

## 0.5 Trilingual UI Engine

| Requirement | Status | Evidence |
|---|---:|---|
| Shared translation package | ✓ | `packages/i18n` |
| French default | ✓ | `packages/i18n/src/index.ts` |
| Arabic locale with RTL handling | ✓ | `apps/admin-web/src/i18n.ts`, `apps/pos-terminal/src/i18n/index.ts` |
| Darija slot reserved | ✓ | `packages/i18n/messages/darija.json` |
| Quickarte uses next-intl | ✓ | Existing `apps/qr-menu` setup through shared messages |
| Admin/POS use i18next | ✓ | `apps/admin-web/src/i18n.ts`, `apps/pos-terminal/src/i18n/index.ts` |
| No hardcoded Phase 0 shell strings | ✓ | Admin/POS shell strings routed through `packages/i18n` |
| Full Arabic/Darija translations | ⚠ | Arabic content is placeholder/incomplete by locked decision; Darija populated post-pilot |

## 0.6 Hardware Compatibility

| Requirement | Status | Evidence |
|---|---:|---|
| Existing ESC/POS abstraction preserved | ✓ | `apps/qr-menu/lib/printing/*` |
| Network/USB/web print abstractions retained | ✓ | `apps/qr-menu/lib/printing/*` |
| POS terminal remains generic Expo app | ✓ | `apps/pos-terminal/app.json` |
| New hardware integrations | ⚠ | Not Phase 0 scope; future modules extend existing print/hardware abstractions |
| Real printer/device matrix | ⚠ | Requires pilot hardware validation; see `docs/phase-0/PILOT_READINESS.md` |

## 0.7 Security Baseline

| Requirement | Status | Evidence |
|---|---:|---|
| Strong password hashing | ✓ | Better Auth-compatible scrypt verifier in `apps/api/src/auth/better-auth-password.ts` |
| PIN hashing and rate limiting | ✓ | `apps/api/src/auth/pin-hashing.service.ts`, `rate-limit.service.ts` |
| JWT claims include tenant and role context | ✓ | `apps/api/src/auth/jwt.strategy.ts` |
| Refresh-token rotation | ✓ | `apps/api/src/auth/refresh.controller.ts`, `apps/api/test/refresh.integration.test.ts` |
| Audit log table | ✓ | `packages/db-schema/migrations/0021_audit_log.sql` |
| Audit log service | ✓ | `apps/api/src/audit-log/audit-log.service.ts` |
| HTTPS/HSTS/security headers | ✓ | `apps/api/src/main.ts` |
| Secrets ignored and scanned | ✓ | `.gitignore`, `.github/workflows/ci.yml`, `docs/phase-0/SECURITY_AUDIT.md` |
| npm audit high/critical clean | ✓ | `docs/phase-0/SECURITY_AUDIT.md` |
| Historical secret handled | ⚠ | `.env.audit` historical finding requires credential rotation; see `SECURITY_AUDIT.md` |
| CMI tokenization-ready | ⚠ | No CMI implementation in Phase 0; architecture leaves audit/sync/idempotency path open |
| Automated backups | ⚠ | Deployment expectation documented; automation is pre-pilot work |

## 0.8 Performance Targets

| Requirement | Status | Evidence |
|---|---:|---|
| API health endpoint responds quickly under local low load | ✓ | `GET /v1/health`, verified during M8/M9 local checks |
| DB health check path exists | ✓ | `apps/api/src/health/health.service.ts` |
| API Docker image size controlled | ✓ | M8/M9 image target under 250MB |
| POS cold start / add item / KDS / print feature targets | ⚠ | Feature-specific targets apply when those modules exist |
| Offline sync target | ⚠ | Sync framework exists; order sync performance measured once order module exists |

## Overall

Phase 0 is ready for PM sign-off with documented partials. No `✗` Phase 0 foundation blockers remain in code; remaining `⚠` items are intentional deferrals with explicit follow-up docs.
