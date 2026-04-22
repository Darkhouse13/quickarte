# Deployment Runbook

## Infra context

Quickarte runs on an existing **Hetzner CPX42** (8 vCPU / 16 GB RAM / 240 GB SSD) managed by **Coolify**, shared with other production apps. Quickarte is deployed as a dedicated service with a **dedicated Postgres service** — it does not share a database with any other app on the box. **Cloudflare** fronts the domain (`quickarte.fr`) for DNS, SSL, and CDN; TLS between Cloudflare and the origin is provisioned by **Coolify's Let's Encrypt** integration (Cloudflare SSL mode: Full (strict)). The box itself and the Coolify installation are pre-existing — this runbook does not cover server provisioning.

---

## First-time deployment onto the existing box

A one-time checklist. Follow top to bottom. Any step where the exact Coolify UI path is uncertain is marked `{TODO: confirm during first deploy}` — fill it in the first time through so the second deploy is frictionless.

1. **Create the Coolify project.** In Coolify → Projects → New. Name it `quickarte`. `{TODO: confirm whether an existing shared project is preferred over a new one.}`
2. **Add the Quickarte app service.** Project → Resources → + New → Application → Public Repository. Source: this GitHub repo. Branch: `main`. Build pack: **Dockerfile** (repo already ships one — Nixpacks guesses fine on most Next.js apps but a maintained Dockerfile gives us deterministic builds and keeps Next.js' `output: "standalone"` contract explicit). Ports exposed: `3000`. `{TODO: confirm exact Coolify UI path: Build Pack field location.}`
3. **Add a dedicated Postgres service.** Project → Resources → + New → Database → PostgreSQL 16. Name: `quickarte-postgres`. Persistent volume: on (Coolify default). Database name: `quickarte`. User: `quickarte`. Strong generated password. `{TODO: confirm volume path, persistence settings.}`
4. **Docker network between app and Postgres.** Coolify puts both services on the project-scoped Docker network by default. The Postgres service is reachable from the app by its Coolify-internal hostname (e.g. `quickarte-postgres` or `<service>-db-<id>`). Use that hostname in `DATABASE_URL`, not `localhost` or an external IP. `{TODO: record the exact hostname Coolify exposes for the Postgres service.}`
5. **Resource limits (shared-box hygiene).** On the Quickarte app service: memory cap **1 GB**, CPU limit **2 cores**. On the Postgres service: memory cap **1 GB**, CPU limit **1 core**. These prevent a Quickarte spike from starving neighbouring apps on the CPX42. Raise deliberately if Quickarte grows — never silently. `{TODO: confirm exact Coolify UI path for per-service resource limits.}`
6. **DNS: `quickarte.fr` A record.** Cloudflare → DNS → + Add record. Type: A. Name: `@` (apex). Target: Hetzner box public IPv4. Proxy: **ON** (orange cloud). Also add an AAAA for IPv6 if the box has one. Add a CNAME for `www` pointing at `quickarte.fr` (proxied). SSL/TLS mode: **Full (strict)**.
7. **SSL via Coolify.** In the Quickarte app service → Domains → add `quickarte.fr` (and `www.quickarte.fr`). Enable Let's Encrypt. Coolify issues the cert and handles renewal. Verify `https://quickarte.fr` shows a green padlock before moving on. `{TODO: confirm exact Coolify UI path for domain + LE.}`
8. **Environment variables.** Set every var in Coolify → Quickarte app service → Environment Variables. Group by concern (copy from the list at the bottom of this doc). Mark every secret (all `*_SECRET`, `*_KEY`, `*_DSN`, `RESEND_API_KEY`) as "Secret" so they don't appear in build logs. `{TODO: confirm exact Coolify UI path for environment secrets.}`
9. **Stripe webhook endpoint.** dashboard.stripe.com → Developers → Webhooks → Add endpoint. URL: `https://quickarte.fr/api/webhooks/stripe`. Events to subscribe to: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `account.updated`. Save. Copy the signing secret (`whsec_…`) and paste into `STRIPE_WEBHOOK_SECRET` env var, then redeploy.
10. **Production VAPID keys.** On your laptop: `npm run push -- vapid`. This prints two base64 strings. Paste into Coolify env vars as `VAPID_PRIVATE_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Also set `VAPID_SUBJECT=mailto:contact@quickarte.fr` (or whatever address Firefox push services should contact). **Do NOT reuse dev VAPID keys** — rotating them invalidates every subscribed device, so production must start with its own pair.
11. **Resend domain verification.** resend.com → Domains → Add `quickarte.fr`. Resend displays three DNS records (SPF `TXT`, DKIM `CNAME`, DMARC `TXT`). Add them to Cloudflare DNS. Wait for Resend to flip the domain to "Verified" (usually < 10 min; can take an hour). Set `RESEND_API_KEY=re_…` and `CONTACT_EMAIL_FROM="Quickarte <bonjour@quickarte.fr>"` in Coolify env.
12. **Sentry project.** sentry.io → + New Project → Platform: **Next.js** → Team. Name: `quickarte`. Copy the DSN. Set both `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` to the same DSN. Then sentry.io → User Settings → Auth Tokens → Create New Token with scopes `project:releases` + `org:read`. Paste as `SENTRY_AUTH_TOKEN` in Coolify env (build-time only — source-map upload). Also set `SENTRY_ORG` and `SENTRY_PROJECT` env vars to your Sentry org slug and `quickarte` respectively.
13. **Post-deploy migration hook.** Coolify → Quickarte app service → `{TODO: confirm exact Coolify UI path for post-deployment commands}` → set command: `npm run db:migrate`. If this Coolify version does not expose post-deploy hooks, fallback: after each deploy, SSH into the box and run `docker exec -it <quickarte-container> npm run db:migrate`. Document that in the `{TODO:}` marker so you remember.
14. **First deploy.** Coolify → Quickarte app service → Deploy. Watch the build log for:
    - Docker build succeeds (no `lib/env.ts` validation error — all required prod vars set)
    - `next build` succeeds
    - Service starts; `curl https://quickarte.fr/api/health` returns `{"status":"ok","db":"connected",…}` within 2 minutes
    - `https://quickarte.fr/` renders the landing page
    - `https://quickarte.fr/fr/login` renders the login form
15. **Run initial migrations.** If step 13 is wired, they already ran. Otherwise: `docker exec -it <quickarte-container> npm run db:migrate`. Verify migration file execution via `SELECT * FROM drizzle.__drizzle_migrations;`.
16. **Seed the first real merchant manually.** Do **not** run `npm run db:seed` in production — that inserts demo data. See [Seeding the first merchant](#seeding-the-first-merchant) below for the real flow.
17. **Uptime monitor.** Follow README → "Uptime monitoring" to create the BetterStack monitor against `https://quickarte.fr/api/health`.

---

## Regular deployments

- Push to `main`.
- Coolify auto-deploys (or click Deploy in UI if auto-deploy is off).
- Post-deploy hook runs `npm run db:migrate` automatically.
- Within 2 minutes: `curl -fsS https://quickarte.fr/api/health | jq` — confirm `"status":"ok"` and a reasonable `latencyMs`.
- Spot-check `https://quickarte.fr/` (landing) and `https://quickarte.fr/fr/login` (app entry) render without console errors.
- Open sentry.io → Issues and scan the last 10 minutes. New unresolved issues during the window immediately following a deploy usually belong to that deploy.

---

## Rollback

- **Code rollback.** Coolify → Quickarte app service → Deployments → pick the previous green deploy → Redeploy. One-click. This does not touch the database.
- **Migration rollback.** If the bad deploy included a DB migration that needs reverting:
  1. Open the relevant file in `lib/db/migrations/` to see exactly what SQL ran.
  2. Write the inverse SQL (drizzle-kit does not generate down migrations). Keep it minimal — usually a `DROP COLUMN` / `ALTER TABLE … DROP CONSTRAINT`.
  3. Run it via `docker exec -it <quickarte-postgres-container> psql -U quickarte -d quickarte` and paste the SQL.
  4. Delete the corresponding row from `drizzle.__drizzle_migrations` so a re-deploy of the rolled-back code doesn't think the migration is still applied.
  5. Redeploy the previous commit (code rollback step above).

---

## Shared-box considerations

- **Resource limits.** Per step 5, Quickarte is capped at 1 GB RAM + 2 CPU (app) and 1 GB RAM + 1 CPU (Postgres). If Quickarte hits limits and needs more, raise deliberately — do not remove the caps. The goal is that a Quickarte incident cannot degrade other apps on the CPX42. `{TODO: record the actual limits applied in the Coolify UI, in case they differ.}`
- **Postgres isolation.** Quickarte has its own Postgres service and its own volume. Other apps on the box have their own databases. No shared credentials, no cross-database access.
- **Docker network isolation.** Each Coolify project runs on its own Docker bridge network by default. Quickarte's app service can only reach Quickarte's Postgres — not anyone else's.
- **Log rotation.** Coolify configures Docker's default json-file driver with `max-size=10m max-file=3` for each container. No action needed unless you see `/var/lib/docker` filling up; then check individual container log sizes with `du -sh /var/lib/docker/containers/*/*.log`.
- **Backup strategy.** Coolify's Postgres service has a built-in backup feature: daily at 03:00 UTC, retention 14 days. Destination `{TODO: document backup destination — local volume path, S3 bucket, or off-box SFTP. A local-only backup on the same box is not a backup.}`. Test restore at least once by pulling the latest backup and loading into a scratch Postgres — silent backup failures are the worst kind.

---

## Emergency access

- **SSH into the box.** `ssh <user>@<box-ip>` — you already have the key on your laptop. `{TODO: record the SSH user.}`
- **Connect to Quickarte's Postgres specifically.** `docker ps | grep quickarte-postgres` to get the container id, then `docker exec -it <quickarte-postgres-container-id> psql -U quickarte -d quickarte`.
- **Tail Quickarte's app logs.** `docker ps | grep quickarte` for the app container id, then `docker logs -f <quickarte-app-container-id> --tail 200`. Coolify also exposes this in its UI (service → Logs).
- **Restart just Quickarte's service.** Either Coolify → service → Restart, or from SSH: `docker restart <quickarte-app-container-id>`. Postgres keeps running.
- **Check box-wide resource pressure.** `htop` for CPU+RAM, `df -h` for disk (`/` and `/var/lib/docker` matter most), `docker stats --no-stream` for per-container usage.

---

## Known gotchas

1. **Quickarte shares the CPX42 with other production apps.** When diagnosing a Quickarte incident, always first ask: is this Quickarte-specific (app logs, Sentry errors, `/api/health` shows DB OK but app misbehaves), or box-wide (CPU/memory pressure from a neighbour, disk full on `/var/lib/docker`, network saturation on the NIC)? A box-wide issue affects every app on the machine and needs coordinated remediation — don't keep restarting Quickarte if the real cause is another app eating all the RAM.
2. **Stripe webhook signing secret is per-environment.** Production's `STRIPE_WEBHOOK_SECRET` comes from the dashboard endpoint (step 9). Dev's comes from `stripe listen`. They are not interchangeable — pasting the dev one into prod silently breaks every webhook with a 400.
3. **VAPID keys must not be rotated after go-live.** Every subscribed merchant device holds a subscription tied to the public key. Rotating VAPID keys invalidates every subscription and the only fix is asking each merchant to unsubscribe + resubscribe, which they will not do.
4. `{TODO: populate as things break in practice.}`

---

## Seeding the first merchant

Do **not** run `npm run db:seed` in production — that script is for dev and creates fake demo data (Camille at Café des Arts, etc.). The production-first-merchant flow:

1. Merchant opens `https://quickarte.fr/fr/register` and creates an account.
2. Merchant completes `/onboarding`, which creates their `businesses` row and `<slug>`.
3. **Admin grants entitlements** — SSH or Coolify shell, then:
   ```sh
   npm run entitlements -- grant <slug> menu_qr
   # plus any other paid modules based on their deal:
   npm run entitlements -- grant <slug> online_ordering
   npm run entitlements -- grant <slug> loyalty
   npm run entitlements -- grant <slug> analytics
   ```
   (The in-app admin UI also works once `QUICKARTE_ADMIN_EMAILS` is set; CLI bypasses that allowlist.)
4. Merchant opens `/fr/settings` → Stripe Connect → completes Express onboarding flow on Stripe's hosted page. Verify via `npm run stripe -- status <slug>` that charges are enabled.
5. Merchant adds menu items via `/fr/catalog`.
6. Share the public URL with them: `https://quickarte.fr/fr/<slug>`. Their QR code is rendered on `/fr/home`.

---

## Env vars to set in Coolify

Grouped by concern. Exact formats + descriptions live in the README env vars table.

**Database**
- `DATABASE_URL`

**Auth (Better Auth)**
- `BETTER_AUTH_SECRET` — generate fresh, ≥32 random chars
- `BETTER_AUTH_URL` — `https://quickarte.fr`
- `NEXT_PUBLIC_APP_URL` — `https://quickarte.fr`
- `NEXT_PUBLIC_CANONICAL_URL` — `https://quickarte.fr`

**Stripe**
- `STRIPE_SECRET_KEY` — `sk_live_…`
- `STRIPE_PUBLISHABLE_KEY` — `pk_live_…`
- `STRIPE_WEBHOOK_SECRET` — `whsec_…` from dashboard endpoint
- `QUICKARTE_PLATFORM_FEE_BPS` — `0` (subscription model)

**Web Push (VAPID)**
- `VAPID_PRIVATE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_SUBJECT` — `mailto:contact@quickarte.fr`

**Email (Resend)**
- `RESEND_API_KEY` — `re_…`
- `CONTACT_EMAIL_FROM` — `Quickarte <bonjour@quickarte.fr>`

**Sentry**
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN` — build-time only
- `SENTRY_ORG`
- `SENTRY_PROJECT`

**Misc**
- `NODE_ENV=production` (Coolify usually sets this)
- `QUICKARTE_ADMIN_EMAILS` — comma-separated, for in-app admin actions
- `NEXT_PUBLIC_SALES_CONTACT` — `mailto:hello@quickarte.fr`
