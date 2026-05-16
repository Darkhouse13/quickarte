# @quickarte/db-schema

This package owns the shared Drizzle schema and migration files for Phase 0.

## Migration Ownership

During Phase 0, `apps/qr-menu` is the only application allowed to run migrations. Root `db:*` scripts continue to proxy through `@quickarte/qr-menu`, and the Quickarte app delegates Drizzle generation/migration commands to this package because the schema and migration files live here.

When `apps/api` is introduced in M3, it may import schema objects from `@quickarte/db-schema`, but it must not run migrations independently. The API should treat this package as read-only schema metadata until migration ownership is explicitly revisited and documented.

No app should run migrations automatically on startup in Phase 0.

## Drizzle Snapshot Metadata

`pnpm db:generate` must be safe in non-interactive shells because CI and Codex runs do not have a TTY. When adding a custom or hand-written SQL migration, also keep `migrations/meta/*_snapshot.json` aligned with the schema state after that migration. If the latest snapshot lags behind the latest applied migration, Drizzle may try to rediscover old column changes and fail with an interactive `promptColumnsConflicts` prompt.
