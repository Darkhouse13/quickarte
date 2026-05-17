# Phase 0 Developer Guide

This directory documents Phase 0 of the Mizan POS project. The new POS/management foundation lives alongside the existing Quickarte application in the same monorepo. Quickarte remains the QR menu/order/loyalty app; the new API, admin web, and POS terminal build the foundation for future Foodics-parity modules.

## Repo Layout

```text
apps/qr-menu        Existing Quickarte Next.js app
apps/api            NestJS API on port 3001
apps/admin-web      Vite React admin SPA on port 3002
apps/pos-terminal   Expo React Native POS terminal
packages/config     Shared TS/ESLint/Prettier config
packages/db-schema  Drizzle schema, migrations, and seeds
packages/i18n       Shared translations
packages/shared-types OpenAPI-generated SDK
packages/ui         Reserved shared UI package
```

Read `docs/phase-0/ARCHITECTURE.md` for the deeper system view.

## Local Development

1. Install Node 20 and pnpm 9.12.0.
2. Install dependencies:

```bash
pnpm install --frozen-lockfile
```

3. Start local infrastructure:

```bash
docker compose up -d postgres redis
```

4. Configure env files from the examples. Required API values include:

```bash
DATABASE_URL=postgres://quickarte:quickarte@localhost:5432/quickarte
REDIS_URL=redis://localhost:6379
JWT_SECRET=<long-local-secret>
JWT_ISSUER=http://localhost:3001
JWT_AUDIENCE=quickarte-api
TENANT_ROOT_DOMAIN=lvh.me
```

5. Run migrations and permission seed:

```bash
pnpm db:migrate
pnpm db:seed:permissions
```

6. Generate the SDK after API changes:

```bash
pnpm sdk:generate
```

7. Run the API:

```bash
pnpm --filter @quickarte/api dev
```

8. Run the admin web:

```bash
pnpm --filter @quickarte/admin-web dev
```

9. Run the POS terminal:

```bash
pnpm --filter @quickarte/pos-terminal dev
```

10. Run Quickarte:

```bash
pnpm --filter @quickarte/qr-menu dev
```

## Common Tasks

Add a new package:

1. Create `packages/<name>/package.json`.
2. Use the `@quickarte/<name>` workspace naming pattern.
3. Add `build`, `typecheck`, and `lint` scripts when applicable.
4. Keep package exports explicit.

Add a new permission:

1. Add the permission id to the permission seed in `packages/db-schema`.
2. Map it to system roles intentionally.
3. Bump or initialize `permission_versions` for affected tenants.
4. Protect endpoints with `@RequirePermission(...)`.

Add a new tenanted table:

1. Include `business_id uuid NOT NULL`.
2. Enable and force RLS in the same migration.
3. Add fail-closed `USING` and `WITH CHECK` policies using `app.current_business_id`.
4. Query it through `DatabaseService.withTenant()`.
5. Add an integration test proving cross-tenant isolation.

Regenerate SDK after API changes:

```bash
pnpm sdk:generate
git diff --exit-code packages/shared-types/src/api.ts
```

Add a tenant:

1. Insert a business row through the current seed/manual setup path.
2. Seed system roles for the business.
3. Create owner/manager staff credentials.
4. Use the business slug for admin web subdomain login.

## Gotchas

- Use `pnpm.cmd` from PowerShell if script execution blocks `pnpm.ps1`.
- Quickarte/root scripts own migration execution in Phase 0. The API must not run migrations at startup.
- RLS depends on transaction-scoped `SET LOCAL`, never connection-scoped settings.
- Better Auth web sessions remain for Quickarte; the new API issues JWTs for admin web and POS.
- Refresh tokens are stored in localStorage in admin web for Phase 0. HttpOnly cookie refresh is deferred.
- Quickarte lint still has documented warnings; CI expects zero lint errors.
- Real-device POS smoke is a pre-pilot gate, documented in `POS_SMOKE_TEST_RESULT.md` and `PILOT_READINESS.md`.

## Phase 0 Docs

- `PLAN.md` - milestone plan.
- `MVP_Feature_Spec_v1.md` - canonical feature spec snapshot.
- `SPEC_AMENDMENTS.md` - locked-decision overrides.
- `AUTH_FEASIBILITY.md` - Better Auth/JWT feasibility.
- `SUPER_ADMIN_DECISION.md` - Pattern A recommendation and invariants.
- `SUBDOMAIN_ROUTING.md` - tenant slug and CORS strategy.
- `RLS_ROLLOUT_PLAN.md` - RLS rollout and deferrals.
- `SECURITY_AUDIT.md` - audit, secrets, and rate-limit findings.
- `DEPLOYMENT.md` - Coolify/Hetzner deployment guide.
- `VERIFICATION_CHECKLIST.md` - Phase 0 requirement verification.
- `POS_SMOKE_TEST_RESULT.md` - POS hardware smoke status.
- `PILOT_READINESS.md` - pre-pilot blockers.
- `FINAL_REPORT.md` - final Phase 0 summary.

## What's Next

Phase 1 should build feature modules on this foundation instead of changing the foundation shape. The recommended starting point is the restaurant/business setup module because it hardens tenant profile, branch, tax, role, printer, and operating settings used by menu, POS, orders, reporting, and integrations.
