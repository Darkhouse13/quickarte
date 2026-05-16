# @quickarte/db-schema

This package owns the shared Drizzle schema and migration files for Phase 0.

## Migration Ownership

During Phase 0, `apps/qr-menu` is the only application allowed to run migrations. Root `db:*` scripts continue to proxy through `@quickarte/qr-menu`, and the Quickarte app delegates Drizzle generation/migration commands to this package because the schema and migration files live here.

When `apps/api` is introduced in M3, it may import schema objects from `@quickarte/db-schema`, but it must not run migrations independently. The API should treat this package as read-only schema metadata until migration ownership is explicitly revisited and documented.

No app should run migrations automatically on startup in Phase 0.
