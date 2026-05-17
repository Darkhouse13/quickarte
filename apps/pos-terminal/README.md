# Mizan POS Terminal

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

The real-device smoke test is a blocking pre-pilot item. Phase 0 created the
offline-first foundation, but Windows local tooling in M9 did not include a ready
Android emulator or physical development client.

Before any pilot customer touches the POS terminal, run this checklist on a real
Android tablet or iPad-compatible development build:

1. Start local Postgres, Redis, API, and seeded permissions.
2. Start Expo with `pnpm --filter @quickarte/pos-terminal dev`.
3. Open the app through an Android emulator, Android development client, or iOS
   development client.
4. Log in with a seeded staff PIN.
5. Confirm the home screen shows the business name from `/v1/sync/pull`.
6. Disable network connectivity from device settings.
7. Confirm the business name remains visible from SQLite cache.
8. Confirm the sync indicator turns red within 30 seconds.
9. Re-enable network connectivity.
10. Confirm the sync indicator returns green within 30 seconds and queued writes
    flush successfully.

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
