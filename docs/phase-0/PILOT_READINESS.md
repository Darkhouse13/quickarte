# Pilot Readiness Checklist

Status: Not pilot-ready until the blocking items below are closed.

## Blocking Before Any Pilot Customer

- [ ] Run the POS real-device smoke test from `apps/pos-terminal/README.md`.
- [ ] Capture screenshots or a screen recording of login, initial sync, offline cache, red offline indicator, reconnect, and green synced state.
- [ ] Rotate or disable the historical `.env.audit` test credential found by Gitleaks in commit `a5fa4e9e`.
- [ ] Configure production `TENANT_ROOT_DOMAIN`, API URL, JWT secret, Postgres URL, Redis URL, and Coolify service env values.
- [ ] Confirm Coolify deploys QR menu, API, and admin web independently from the monorepo.
- [ ] Enable automated Postgres backups with at least 30-day retention.

## Strongly Recommended Before Pilot

- [ ] Apply `docs/design/mizan-tokens.css` once the token file lands.
- [ ] Decide whether the Mizan naming pass should include repo/package rename work after Phase 0.
- [ ] Run a manual admin-web login smoke test against a seeded tenant on the final deployment target.
- [ ] Run `pnpm audit --prod` again and reassess moderate findings.

## Evidence To Attach

- POS smoke screenshots or video.
- Deployment URLs for QR menu, API docs, and admin web.
- `curl -I` output showing API security headers in production.
- Postgres backup restore proof.
