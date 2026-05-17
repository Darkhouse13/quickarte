# Phase 0 Deployment

Status: M8 monorepo deployment baseline.

## Deployment Model

The repo is a pnpm/Turborepo monorepo. Coolify should deploy each app as a separate service from the same repository and branch.

Services in Phase 0:

| Service | Workspace | Runtime | Public URL |
|---|---|---|---|
| QR menu | `apps/qr-menu` | Next.js container | Tenant/customer QR menu domain |
| API | `apps/api` | NestJS container | `api.${TENANT_ROOT_DOMAIN}` or equivalent stable API host |
| Admin web | `apps/admin-web` | Static Vite output | `{slug}.${TENANT_ROOT_DOMAIN}/admin` or a Coolify route to the static app |
| POS terminal | `apps/pos-terminal` | Expo dev/build artifact | Not deployed by Coolify in Phase 0 |

## API Docker Image

`apps/api/Dockerfile` uses a three-stage build:

1. `deps`: installs only the API workspace closure with pnpm.
2. `builder`: compiles the NestJS app and runs `pnpm deploy --filter @quickarte/api --prod` to create a self-contained production payload.
3. `runner`: copies only the deploy payload into a small Alpine image with the Node binary, CA certificates, and a non-root `nestjs` user.

The runner image must not include unrelated monorepo packages such as Next.js, Expo, React Native, Hermes, or Quickarte web dependencies.

Verification command:

```sh
docker run --rm quickarte-api:m8-test find /app/node_modules -maxdepth 4 -type d \( -name "next" -o -name "expo*" -o -name "react-native*" \)
```

Expected output: none.

## Coolify Configuration

### QR Menu

- Build context: repo root
- Dockerfile: `Dockerfile`
- Port: `3000`
- Build command: handled by Dockerfile
- Required env: see `apps/qr-menu/.env.example`

### API

- Build context: repo root
- Dockerfile: `apps/api/Dockerfile`
- Port: `3001`
- Required env:
  - `DATABASE_URL`
  - `REDIS_URL`
  - `JWT_SECRET`
  - `JWT_ISSUER`
  - `JWT_AUDIENCE`
  - `TENANT_ROOT_DOMAIN`
  - `API_PORT=3001`
  - `NODE_ENV=production`
  - `LOG_LEVEL=info`

### Admin Web

- Build context: repo root
- Build command: `pnpm install --frozen-lockfile && pnpm --filter @quickarte/admin-web build`
- Publish directory: `apps/admin-web/dist`
- Required env:
  - `VITE_API_BASE_URL=https://api.${TENANT_ROOT_DOMAIN}/v1`
  - `VITE_TENANT_ROOT_DOMAIN=${TENANT_ROOT_DOMAIN}`

## Environment And Secrets

- Secrets live in Coolify environment variables, not committed files.
- `.env`, `.env.local`, `.env*.local`, `.env.audit`, and `*.log` are ignored at the repo root.
- CI uses test-only service credentials for Postgres/Redis and a non-production JWT secret.
- Production JWT secrets must be generated outside the repo and rotated through Coolify.

## TLS And Reverse Proxy

Coolify should terminate TLS with Let's Encrypt unless an external reverse proxy is used. The API expects TLS to terminate upstream and still emits:

- HSTS
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`

The reverse proxy must preserve:

- `X-Forwarded-For`
- `X-Forwarded-Proto`
- `X-Request-Id` if generated upstream

## Tenant DNS

Production DNS:

- Wildcard record: `*.${TENANT_ROOT_DOMAIN}` to Coolify/proxy
- API record: `api.${TENANT_ROOT_DOMAIN}` to the API service

Development DNS:

- `*.lvh.me` resolves to `127.0.0.1`
- `TENANT_ROOT_DOMAIN=lvh.me`

## CORS

The API uses a function-based CORS origin policy:

- allows localhost development hosts
- allows `${TENANT_ROOT_DOMAIN}`
- allows `*.${TENANT_ROOT_DOMAIN}`

Credentials are disabled in M8 because admin web stores bearer tokens in localStorage. If/when refresh tokens move to httpOnly cookies, CORS must be revisited to enable credentials only for trusted tenant origins.

## Database Backups

Phase 0 documents the expectation but does not automate backups. Before pilot:

- enable automated nightly Postgres backups
- retain at least 30 days per spec
- test restore into a clean environment

## Coolify Monorepo Caveat

Coolify monorepo deployment is not turnkey. Each app must have an explicit service config, build context, Dockerfile/build command, and env set. Do not rely on one root deployment to infer all apps.
