# Quickarte POS Terminal

Expo React Native scaffold for the offline-first POS terminal.

## Local Setup

1. Start local infrastructure from the repo root:
   ```sh
   docker compose up -d postgres redis
   ```
2. Apply migrations and seed starter permissions:
   ```sh
   $env:DATABASE_URL="postgres://quickarte:quickarte@localhost:5433/quickarte"
   pnpm db:migrate
   pnpm db:seed:permissions
   ```
3. Start the API:
   ```sh
   $env:DATABASE_URL="postgres://quickarte:quickarte@localhost:5433/quickarte"
   $env:JWT_SECRET="local-dev-secret-local-dev-secret-local-dev"
   $env:REDIS_URL="redis://localhost:6379"
   pnpm --filter @quickarte/api dev
   ```
4. Start Expo:
   ```sh
   pnpm --filter @quickarte/pos-terminal dev
   ```

## Simulator Flows

- iOS simulator: press `i` in the Expo terminal after the dev server starts.
- Android emulator: start an emulator through Android Studio, then press `a`.
- Expo Go can open the dev server QR code for the JS shell, but WatermelonDB SQLite requires a development build before native persistence is fully available.

## Manual Smoke Test

The full simulator or real-device smoke test is deferred to M9 sign-off. Before pilot,
this checklist must be run on real Android hardware or an iPad-compatible development
build, because WatermelonDB persistence and network toggling need native runtime
verification.

1. Start local Postgres, Redis, API, and seeded permissions as above.
2. Start the Expo dev server with `pnpm --filter @quickarte/pos-terminal dev`.
3. Open on iOS simulator or Android emulator.
4. Log in with a seeded staff PIN. For the M5 integration seed, owner PIN is `1234`; use that seed's business UUID until slug resolution lands.
5. Verify the home screen shows the business name. This proves `/v1/sync/pull` hydrated the local WatermelonDB cache.
6. Disable network from the simulator or emulator settings.
7. Verify the home screen still shows the business name. This proves the shell is reading SQLite cache, not relying on a live request.
8. The sync indicator should turn red within 30 seconds.
9. Re-enable network.
10. The sync indicator should return green within 30 seconds after foreground polling runs again, or immediately after tapping "Synchroniser".

## Sync Surface In M6

Pull endpoint: `GET /v1/sync/pull?since=<ISO timestamp>`.

Tables exposed:

- `businesses`: `id`, `name`, `slug`, `locale`, `currency`, `timezone`, `last_synced_at`
- `staff_members`: `id`, `business_id`, `display_name`, `role`, `last_synced_at`

Push endpoint: `POST /v1/sync/push`.

Allowed push table:

- `audit_log` created rows only. Any other table returns Problem Details type `sync-table-not-allowed`.

## Notes

- Background sync is foreground polling every 30 seconds in Phase 0.
- True background fetch, Detox/Maestro, and conflict-resolution UI are deferred.
- Server timestamp wins on conflict; see `src/sync/conflict.ts`.
