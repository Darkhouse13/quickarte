# RLS Rollout Plan

## Current M4 Scope

M4 enables strict PostgreSQL row-level security only on `audit_log`.

Reason: `audit_log` is owned by the new NestJS API foundation and every write now goes through `DatabaseService.withTenant()`, which opens a transaction and sets `app.current_business_id` with `SET LOCAL` before touching tenanted data.

RLS is intentionally deferred for Quickarte-shared tables because Quickarte still queries those tables directly through its Next.js server actions, scripts, and route handlers without transaction-scoped tenant context. Enabling fail-closed RLS on those tables in M4 would break existing Quickarte behavior and violate the milestone rule that Quickarte must keep working.

## Strict Policy Pattern

All RLS policies must fail closed. Do not add permissive policies that allow access when tenant context is unset.

The approved policy shape is:

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_name FORCE ROW LEVEL SECURITY;

CREATE POLICY table_name_tenant_isolation ON table_name
  USING (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
```

`FORCE ROW LEVEL SECURITY` is required so the table owner cannot silently bypass RLS. Production application roles must also be non-superuser and `NOBYPASSRLS`.

## Tables With RLS Enabled

- `audit_log`

## Tenanted Tables Without RLS Yet

Best-effort enumeration from `packages/db-schema/src/schema/*` as of M4:

- `businesses`
- `business_settings`
- `business_entitlements`
- `staff_members`
- `categories`
- `products`
- `orders`
- `printers`
- `category_print_routes`
- `reservations`
- `loyalty_programs`
- `loyalty_members`
- `loyalty_customers`
- `loyalty_transactions`
- `redemption_listings`
- `credit_transactions`
- `google_review_grants`
- `promo_codes`
- `push_subscriptions`

Derived child tables that do not carry `business_id` directly, such as `order_items`, `order_events`, `print_jobs`, product option tables, and staff invite tokens, need a per-table design before RLS is enabled. They may require denormalized `business_id`, join-based policies, or access only through parent-table operations.

## Trigger To Enable RLS On The Rest

RLS on Quickarte-shared tenanted tables can be enabled when Quickarte has been refactored so all DB access to tenanted data goes through a tenant-scoped helper equivalent to `DatabaseService.withTenant()`.

That refactor must land with per-table RLS migrations and integration tests proving:

- correct tenant sees its own rows
- wrong tenant sees zero rows
- unset tenant context sees zero rows
- cross-tenant insert/update fails
- pooled connections do not leak tenant context between requests

## Rule For New Tables From M4 Onward

Any new tenanted table created after M4 must ship with RLS enabled by default in the same migration that creates the table.

No new tenanted table may be introduced with a permissive policy for unset tenant context.
