# Phase 0 Final Report

## Summary

Phase 0 converted the repository into a pnpm/Turborepo monorepo while preserving the existing Quickarte app. It added the new Mizan POS foundation: NestJS API, generated SDK, Vite admin shell, Expo POS shell, shared i18n, shared Drizzle schema package, RLS for new API-owned tenanted tables, JWT auth, permission checks, refresh rotation, rate limits, and the first offline sync skeleton. Quickarte remains in `apps/qr-menu` and continues to own existing QR/order/loyalty behavior. No feature modules were built in Phase 0.

## Acceptance

The requirement-by-requirement sign-off is in `docs/phase-0/VERIFICATION_CHECKLIST.md`.

Phase 0 is considered foundation-complete with documented partials:

- Quickarte-shared tables do not yet have RLS because Quickarte still uses legacy DB access paths.
- POS real-device smoke is deferred to pre-pilot hardware verification.
- `docs/design/mizan-tokens.css` was not present at M9 start, so token application is deferred until the design token file lands.
- Full feature sync coverage starts when feature modules exist.
- Super-admin Pattern A is selected but not implemented.
- CMI integration is deferred to Module 8 while the audit/sync/idempotency architecture remains compatible.

## Tech Debt Accepted

- `pnpm audit --prod` currently has 6 moderate and 1 low finding, with zero high or critical findings. Deferred items are documented in `SECURITY_AUDIT.md`.
- Quickarte lint reports 108 warnings and 0 errors; warning cleanup is deferred to a focused Quickarte quality pass.
- Admin web stores refresh tokens in localStorage for Phase 0. HttpOnly cookie refresh requires a CORS-with-credentials pass and is deferred.
- RLS is not enabled on Quickarte-shared tables until Quickarte is refactored to use tenant-scoped DB access.
- Real-device POS smoke is deferred to pre-pilot and tracked in `PILOT_READINESS.md`.
- `next-intl` 3 to 4 major upgrade remains deferred because it is outside Phase 0 foundation scope.
- `ManagerOverrideGuard` has a cosmetic Cartesian join concern to tidy during auth hardening follow-up.
- `DashboardPage` has a cosmetic "member since" label issue to revisit with the real staff profile module.
- Sync engine deletion tracking is not complete; feature modules must add explicit deleted-row tracking.
- Customer-facing POS names now use Mizan and bundle id `ma.mizan.posterminal`; internal workspace package names remain `@quickarte/*` until a dedicated rebrand pass.
- Mizan design token application is deferred because `docs/design/mizan-tokens.css` is absent in the repository.

## Decisions Surfaced But Deferred

- Pattern A super-admin implementation with both `app.current_business_id` and `app.is_platform_admin = 'true'`.
- Tenant API keys for third-party integrations.
- True background sync using native background fetch/task APIs.
- Custom JWT library evaluation if Better Auth/JWT integration needs deeper consolidation.
- Historical `.env.audit` credential rotation from the Gitleaks finding in commit `a5fa4e9e`.

## Recommended Phase 1 Starting Point

Start Phase 1 with the restaurant/business setup and configuration module before menu/order feature depth. This module exercises tenant profile data, branch/settings shape, permissions, admin web forms, API validation, audit logging, and POS sync without forcing complex order workflows too early. It also creates stable configuration primitives for later menu, stock, POS, KDS, reporting, printing, and CMI payment modules.

After that, the next best sequence is menu/catalog foundation, then stock/recipe deduction, then POS order flow.
