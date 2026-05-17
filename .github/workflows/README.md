# GitHub Actions

`ci.yml` runs on pull requests to `main` and `phase-0-foundation`, and on pushes to `main`.

The workflow starts PostgreSQL 16 and Redis 7 service containers, installs with the pinned `pnpm@9.12.0`, then runs:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm sdk:generate`
- `git diff --exit-code packages/shared-types/src/api.ts packages/shared-types/openapi.json`
- `gitleaks/gitleaks-action` against the current checked-out tree (`--no-git`)

Required CI environment values are test-only placeholders:

- `DATABASE_URL=postgres://quickarte:quickarte@localhost:5432/quickarte`
- `REDIS_URL=redis://localhost:6379`
- `JWT_SECRET=ci-test-secret-ci-test-secret-ci-test`
- `JWT_ISSUER=http://ci/api`
- `JWT_AUDIENCE=quickarte-api`
- `API_PORT=3001`
- `LOG_LEVEL=info`
- `NODE_ENV=test`

Turborepo remote caching is not enabled in Phase 0 because it requires remote cache credentials and provider setup. Local Turbo caching still works inside a single job.
