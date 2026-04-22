# Quickarte

## Local development

Running `npm run db:seed` wipes the `sessions` table. If a browser tab is logged in from before the reseed, its cookie will be orphaned — the next navigation will bounce to `/login`, which is the correct recovery behavior. Re-authenticate and you're back in.

### Stripe (local testing)

Quickarte uses Stripe Connect so merchants can accept card payments directly into their own Stripe account. Quickarte does **not** take a percentage of orders — the `application_fee_amount` is always zero. Revenue comes from a flat monthly subscription, billed separately; see `docs/04-PRICING-AND-ENTITLEMENTS.md`.

The payment flow uses Express connected accounts with destination charges. To exercise it end-to-end against Stripe test mode:

1. Install the Stripe CLI: `brew install stripe/stripe-cli/stripe` (macOS) or see [Stripe CLI install](https://docs.stripe.com/stripe-cli#install) for Linux / Windows.
2. `stripe login` once to authenticate the CLI against your Stripe test account.
3. In a second terminal, forward webhooks to your local dev server:

   ```sh
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

   The first line it prints is a `whsec_...` webhook signing secret. Paste it into your `.env` as `STRIPE_WEBHOOK_SECRET` (each `stripe listen` session has its own) and restart `npm run dev`.
4. Put your test-mode `sk_test_...` and `pk_test_...` into `.env` as `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY`.
5. Test cards:
   - `4242 4242 4242 4242` — success
   - `4000 0025 0000 3155` — requires 3DS authentication
   - `4000 0000 0000 0002` — generic decline
   - Any future expiry, any CVC, any postal.

Handy once live: `npm run stripe -- status <slug>` prints cached + live Stripe account state for a merchant, and `npm run stripe -- sync <slug>` force-refreshes the cached flags from Stripe. Useful when a merchant says "I finished onboarding but the app still says incomplete."

The seed marks Camille's (`cafe-des-arts`) Stripe fields as already connected with a fake `acct_DEMO_cafe_des_arts` account id, so her `/settings` shows the "Paiements activés" card without real Stripe onboarding. About half her seeded historical orders are flagged paid (with `pi_DEMO_…` / `ch_DEMO_…` fake ids) so the orders board and analytics show a realistic mix. The fake account id can't process real charges — use a real test account for end-to-end payment testing.

### PWA: install + web push

Merchants can install Quickarte to their home screen and receive a push notification when a new order lands (gated by the `online_ordering` entitlement). The service worker (`public/sw.js`) is production-only by default — set `NEXT_PUBLIC_ENABLE_SW_IN_DEV=true` to register it in `next dev`.

Generate VAPID keys once per environment and paste them into `.env`:

```sh
npm run push -- vapid
# or, equivalently:
npx web-push generate-vapid-keys
```

Useful during development:

- `npm run push -- test <slug>` — fire a test notification to every device subscribed for that merchant.
- `npm run push -- list <slug>` — show active subscriptions with their device info and failure counters.

Push requires HTTPS (localhost is exempt). iOS 16.4+ only delivers push to *installed* PWAs — the "Add to Home Screen" flow must complete on a physical device; Safari-in-tab never receives them.

## Environment variables

All env vars are validated at boot by `lib/env.ts` (server) and `lib/env.client.ts` (client). Missing required vars fail the app at startup with a clear diagnostic — the app will not silently run with a half-configured environment.

| Name | Required | Format | Purpose |
|---|---|---|---|
| `DATABASE_URL` | always | Postgres URL | Drizzle connection string |
| `BETTER_AUTH_SECRET` | always | string, ≥16 chars | Session signing key for Better Auth |
| `BETTER_AUTH_URL` | always | URL | Better Auth base URL (usually same as APP_URL) |
| `NEXT_PUBLIC_APP_URL` | always | URL | Canonical app origin used for links and QR codes |
| `NEXT_PUBLIC_CANONICAL_URL` | always | `https://…` URL | Public URL given to third parties (Stripe business_profile, emails) |
| `STRIPE_SECRET_KEY` | prod-only | `sk_…` | Stripe platform secret key |
| `STRIPE_PUBLISHABLE_KEY` | prod-only | `pk_…` | Stripe publishable key, forwarded to Payment Element |
| `STRIPE_WEBHOOK_SECRET` | prod-only | `whsec_…` | HMAC secret for `/api/webhooks/stripe` |
| `VAPID_PRIVATE_KEY` | prod-only | base64 | Web Push signing key |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | prod-only | base64 | Web Push public key, sent to browser |
| `VAPID_SUBJECT` | prod-only | `mailto:` or `https://` URL | VAPID contact, required by push services |
| `RESEND_API_KEY` | prod-only | `re_…` | Resend API key for transactional email |
| `CONTACT_EMAIL_FROM` | prod-only | email or `Name <addr@host>` | From-address on contact alerts |
| `SENTRY_DSN` | prod-only | URL | Sentry DSN for server + edge runtime |
| `NEXT_PUBLIC_SENTRY_DSN` | prod-only | URL | Sentry DSN for the browser bundle |
| `QUICKARTE_PLATFORM_FEE_BPS` | optional | integer 0–10000 | Platform fee in basis points (default `0`) |
| `QUICKARTE_ADMIN_EMAILS` | optional | comma-separated emails | Allowlist for entitlement server actions |
| `NEXT_PUBLIC_SALES_CONTACT` | optional | email, tel, or URL | UpsellCard CTA target |
| `NEXT_PUBLIC_LAN_URL` | optional | URL | Extra trusted origin (e.g. `http://192.168.x.x:3000`) |
| `NEXT_PUBLIC_ENABLE_SW_IN_DEV` | optional | `true`/`false` | Register the service worker in `next dev` |
| `SENTRY_AUTH_TOKEN` | optional | string | Source-map upload token at build time |
| `COOLIFY_GIT_COMMIT_SHA` | optional (set by Coolify) | string | Release label used by Sentry |

## Uptime monitoring

The app exposes `GET /api/health`, which runs `SELECT 1` against Postgres and returns a JSON payload. On success: `200` with `{"status":"ok","db":"connected",…}`. On DB failure: `503` with `{"status":"degraded","db":"disconnected",…}`. No auth, no rate limit, no PII.

To wire external uptime monitoring:

1. Sign up for [BetterStack](https://betterstack.com/better-uptime) (free tier).
2. Create a monitor:
   - URL: `https://quickarte.fr/api/health`
   - Interval: every 3 minutes
   - Expect: HTTP 200 and response body containing `"status":"ok"`
   - Alert channel: email
   - Alert if down for > 5 minutes.
3. Keep the monitor in the same region as the Hetzner box (EU) to avoid false positives on transatlantic jitter.
