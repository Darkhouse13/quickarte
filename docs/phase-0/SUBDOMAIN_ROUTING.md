# Subdomain Routing Strategy

## Tenant Slug Resolution

Tenant-facing web apps use subdomains in the form:

```text
{slug}.{TENANT_ROOT_DOMAIN}
```

The slug resolves to a tenant by looking up `businesses.slug` and returning the matching `businesses.id` as `business_id`.

The tenant key remains `business_id` everywhere in code, schema, JWT claims, SDK types, and future documentation. Slugs are routing identifiers only; they are not the tenant key.

## Development DNS

Development should use wildcard-friendly local domains:

- `*.lvh.me`
- `*.localhost` where supported by the browser and OS resolver

Examples:

- `cafe-atlas.lvh.me:3002` for admin web after M7
- `cafe-atlas.lvh.me:3000` for Quickarte local checks if needed

## Production DNS

Production uses a configurable root domain:

```text
TENANT_ROOT_DOMAIN=yourapp.ma
```

The final production domain is deferred until launch. DNS should be configured with a wildcard record for tenant apps:

```text
*.yourapp.ma
```

The architecture must not depend on a Hetzner-specific DNS feature.

## Which Apps Use Subdomains

- Admin web: yes. Tenant context is naturally loaded from `{slug}.{TENANT_ROOT_DOMAIN}/admin`.
- QR-menu storefront: yes where existing Quickarte routing requires it, but Phase 0 does not refactor Quickarte routing.
- API: no tenant-specific API subdomain in Phase 0. API stays on a stable base URL and receives tenant context through headers/JWT.
- POS terminal: no subdomain. The terminal uses `API_BASE_URL` plus authenticated tenant claims after M5.

## How The API Receives Tenant Context

M4 uses a development header:

```text
X-Tenant-Id: <business_id uuid>
```

M5 replaces this as the primary source with JWT claims carrying `business_id` and role/permissions. The M4 header can remain as a development/test fallback only if explicitly allowed.

For subdomain-routed web traffic, the web app resolves `{slug}` to `business_id`, then calls the API with authenticated tenant context. A future `X-Tenant-Slug` lookup path may be added only if it is backed by a server-side lookup and still results in `business_id` being set before any tenanted query.

## Coolify Implications

Coolify should deploy each app independently from the monorepo with per-app build commands and environment variables.

Required environment variables for tenant routing:

- `TENANT_ROOT_DOMAIN`
- app-specific public URL variables
- API base URL variables consumed by admin web and POS terminal

Wildcard DNS and reverse-proxy routing must be configured outside the application code. The app should read `TENANT_ROOT_DOMAIN`, not hardcode production domains.
