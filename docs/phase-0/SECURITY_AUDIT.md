# Phase 0 Security Audit

Status: M8 baseline implemented locally.

## npm Audit

Commands run:

- `pnpm audit --prod`
- `pnpm audit`

M8 remediated the high-severity production findings by upgrading the admin web Vite and React Router surface and pinning transitive Vite resolution through a pnpm override.

Current `pnpm audit --prod` result:

- High: 0
- Critical: 0
- Moderate: 6
- Low: 1

Deferred moderate/low findings:

| Package | Severity | Path | M8 decision |
|---|---:|---|---|
| `next-intl` | Moderate | Quickarte QR menu | Deferred. Patched line requires a major upgrade from 3.x to 4.9.2+. That is not a safe M8-only patch because Quickarte production routing/translations must remain unchanged. |
| `postcss` | Moderate | Next/Expo transitive paths | Deferred. Transitive framework dependency; no high/critical production finding remains. Revisit during M8/M9 dependency hardening or framework patch releases. |
| `esbuild` | Moderate | `drizzle-kit` / Better Auth transitive dev tooling | Deferred. Dev-server exposure advisory; no runtime API image includes Drizzle Kit. |
| `@babel/runtime` | Moderate | WatermelonDB | Deferred. Transitive mobile dependency; no direct patched WatermelonDB version confirmed in M8. |
| `@tootallnate/once` | Low | jsdom transitive test tooling | Deferred. Test-only low severity. |

## Rate Limit Policy

| Endpoint | Limit | Key | Notes |
|---|---:|---|---|
| `POST /v1/auth/staff/pin-login` | 5 attempts / 5 minutes, then 10-minute lockout | `ip:businessId` | Existing M5 behavior retained. |
| `POST /v1/auth/owner/login` | 5 attempts / 5 minutes, then 10-minute lockout | `ip:businessSlug` | Existing M7 behavior retained. |
| `POST /v1/auth/refresh` | 10 attempts / 5 minutes | `ip:refresh_token_hash_prefix` | Token-specific key prevents one user's failures from locking everyone. |
| `GET /v1/sync/pull` | 60 requests / minute | `businessId` | Supports a POS polling every 30 seconds with room for manual sync. |
| `POST /v1/sync/push` | 60 requests / minute | `businessId` | Same tenant-scoped sync budget as pull. |
| `GET /v1/audit-log` | 30 requests / minute | `businessId` | Moderate admin/reporting read budget. |

All rate-limit failures return Problem Details type `https://api.quickarte.ma/problems/rate-limit-exceeded` and include `retry_after_seconds`.

## Secrets Scan

Current tree scan:

- Tool: Gitleaks Docker image `zricethezav/gitleaks:latest`
- Command shape: copy current tree excluding `.git`, `node_modules`, build outputs, and run `gitleaks detect --no-git --redact --verbose`
- Result: no leaks found

Git history scan:

- Tool: Gitleaks Docker image `zricethezav/gitleaks:latest`
- Command: `gitleaks detect --source=/repo --redact --verbose --log-opts="--all -- . ':!node_modules' ':!apps/qr-menu/.next'"`
- Result: one historical finding in `.env.audit` at commit `a5fa4e9e` (`TEST_PASSWORD` on line 2)
- Required PM action: treat that credential as exposed. Disable or rotate the referenced test account/password, even if it was believed to be non-production.

Repository controls:

- Root `.gitignore` already excludes `.env`, `.env.local`, `.env*.local`, `.env.audit`, and related local secret files.
- CI uses Gitleaks on the current checked-out tree to prevent new secrets from entering PRs while the historical `.env.audit` incident is tracked separately.

## Auth Security Verification

- Better Auth password compatibility: the API now verifies Quickarte credential hashes with a local Better Auth-compatible scrypt verifier using `N=16384`, `r=16`, `p=1`, `dkLen=64`, hex salt, and timing-safe comparison.
- PIN hashing: API PINs continue to use the M5 `PinHashingService`.
- JWT signing: `JWT_SECRET` is required through Zod env validation and must be at least 32 characters.
- JWT verification: HMAC signatures use timing-safe comparison. The verifier rejects malformed, expired, wrong-issuer, wrong-audience, and non-`is_platform_admin: false` tokens.
- Platform admin: M8 still forbids platform-admin access. `is_platform_admin` is validated as `false`; Pattern A remains deferred.
- Refresh tokens: stored only as HMAC-SHA256 hashes in `api_refresh_tokens`; the raw token is returned once to the client.
- Refresh rotation: `POST /v1/auth/refresh` revokes the old refresh token and stores a new hash before returning the new token pair.
- Refresh token tenant context: newly issued refresh tokens are opaque credentials prefixed with `business_id` so the API can set strict RLS tenant context before querying `api_refresh_tokens`. The random token segment remains the secret.
- Admin web storage: M8 keeps localStorage per the locked scope. Migration to in-memory access tokens plus httpOnly refresh cookies is explicitly deferred.

## API Headers And CORS

The API uses Helmet and explicit CORS configuration in `apps/api/src/main.ts`.

Headers expected on API responses:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`

CORS behavior:

- Allows `localhost`, `127.0.0.1`, `::1`
- Allows `TENANT_ROOT_DOMAIN`
- Allows any `*.${TENANT_ROOT_DOMAIN}` subdomain
- Keeps credentials disabled in M8 because admin web uses bearer tokens in localStorage

Production note: Coolify or an upstream reverse proxy terminates TLS. The API still emits HSTS/security headers so proxied responses carry the baseline policy.
