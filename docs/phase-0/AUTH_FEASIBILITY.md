# Auth Feasibility

## Outcome

Green: Better Auth can support the Phase 0 API/mobile JWT path without replacing Quickarte's existing web-session auth.

## Findings

- The repo uses Better Auth `1.6.11` for Quickarte email/password sessions through the Drizzle adapter.
- Better Auth's JWT plugin supports `definePayload`, `getSubject`, issuer, audience, and expiration options.
- The plugin's default access-token expiration is 15 minutes, matching the M5 requirement.
- Better Auth's password hashing implementation uses scrypt through `@better-auth/utils/password` in Node runtimes.
- Better Auth's built-in JWT plugin is session-oriented: a user authenticates with Better Auth, then retrieves a JWT from the auth token endpoint.

## M5 Integration Pattern

M5 keeps Better Auth as the credential/session authority and adds an API-owned JWT extension layer:

1. Quickarte web sessions continue to use the existing Better Auth Next.js handler unchanged.
2. API/mobile login flows verify credentials through Better Auth-compatible identity data and hashing.
3. The API issues short-lived access JWTs signed with `JWT_SECRET` and carrying `business_id`, `role_id`, `permissions_version`, and `is_platform_admin: false`.
4. Refresh tokens are high-entropy random tokens stored hashed in the API database layer.
5. PIN login uses the same scrypt hashing primitive family as Better Auth for consistency.

This is an extension alongside Better Auth, not a replacement. It avoids forcing POS PIN login through browser-session cookies while preserving Better Auth for current Quickarte web auth.

## Signing Key And Rotation

M5 uses `JWT_SECRET` from environment validation for HS256 API access tokens. Rotation strategy for Phase 0:

- support one active `JWT_SECRET`
- rotate by deploying a new secret and forcing clients through refresh/login
- add multi-key `kid` rotation later if operational needs require seamless access-token overlap

## Gotchas

- The Better Auth JWT plugin can add custom claims, but its default endpoint assumes a Better Auth session context. PIN login needs an API-native issuance path.
- Platform-admin support is not implemented in M5. The JWT claim exists but is always `false`.
- Tenant API keys from the MVP spec remain deferred for third-party integrations.

## Sources Checked

- Better Auth JWT plugin docs, including custom payload and issuer/audience/expiration options.
- Better Auth bearer plugin docs for bearer-token usage.
- Local Better Auth `1.6.11` type/source files for `definePayload` and scrypt password hashing.
