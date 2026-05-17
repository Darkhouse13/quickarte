# POS Smoke Test Result

Status: Deferred to pre-pilot hardware verification.

## Option Chosen

Option C was chosen.

Android Studio and a tablet emulator were not already installed in the Windows workspace, and installing that toolchain during M9 would have been environment setup rather than repo sign-off work. A real-device smoke test is still required before pilot; it is tracked as a blocking item in `docs/phase-0/PILOT_READINESS.md`.

## What Was Verified In Phase 0

- POS terminal scaffold builds through Expo export during `pnpm build`.
- POS unit test coverage exists for the conflict resolver.
- WatermelonDB schema, sync engine wrapper, outbox table, sync metadata, offline indicator, and PIN login screens exist.
- API sync endpoints exist and are included in the generated SDK.

## What Remains To Verify On Hardware

Run the 10-step checklist in `apps/pos-terminal/README.md` on a physical Android tablet or iPad-compatible development build:

1. Start local Postgres, Redis, API, and seeded permissions.
2. Start Expo with `pnpm --filter @quickarte/pos-terminal dev`.
3. Open the app through an Android emulator, Android development client, or iOS development client.
4. Log in with a seeded staff PIN.
5. Confirm the home screen shows the business name from `/v1/sync/pull`.
6. Disable network connectivity from device settings.
7. Confirm the business name remains visible from SQLite cache.
8. Confirm the sync indicator turns red within 30 seconds.
9. Re-enable network connectivity.
10. Confirm the sync indicator returns green within 30 seconds and queued writes flush successfully.

## Pilot Gate

Pilot readiness is blocked until the checklist above passes on real hardware or on a tablet emulator with native SQLite persistence enabled.
