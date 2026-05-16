# Super-Admin Model Decision

## Context

The product needs an internal platform super-admin for support and operations. M4 intentionally does not implement a bypass. This document records the options for PM sign-off before any bypass is added.

## Pattern A: Platform-Admin Session Variable

Add a transaction-scoped setting such as `app.is_platform_admin = true` alongside `app.current_business_id`. RLS policies would allow rows when either tenant context matches or the platform-admin flag is true.

Pros:

- Keeps one application connection pattern: every request still runs inside a transaction with `SET LOCAL`.
- Works with the existing API middleware model and future JWT claims.
- Easy to require audit-log entries for every platform-admin access.
- No separate Postgres pool or deployment secret needed.

Cons:

- Every RLS policy must include the platform-admin predicate.
- A bug in platform-admin middleware could widen access if not tightly guarded.
- Requires careful tests for both tenant and platform-admin paths on every tenanted table.

Required invariants:

- Platform-admin requests MUST set both `app.current_business_id` and `app.is_platform_admin = 'true'`.
- `app.current_business_id` is the business being acted on, even when platform-admin access is used.
- Setting only `app.is_platform_admin = 'true'` is forbidden because audit-log entries would be ambiguous about which tenant was affected.
- This is a non-negotiable rule for the future Pattern A implementation after M5.

Policy template for tables that support platform-admin access:

```sql
USING (
  business_id = nullif(current_setting('app.current_business_id', true), '')::uuid
  OR current_setting('app.is_platform_admin', true) = 'true'
)
WITH CHECK (
  business_id = nullif(current_setting('app.current_business_id', true), '')::uuid
  OR current_setting('app.is_platform_admin', true) = 'true'
)
```

Effort estimate: 3-5 dev days after M5 auth claims exist, including middleware, policy updates, audit-log flags, and tests.

## Pattern B: Separate DB Role With BYPASSRLS

Create a dedicated Postgres role with `BYPASSRLS` and a separate API connection pool for platform-admin operations.

Pros:

- Clear infrastructure-level privilege separation.
- Tenant policies remain simple for normal application traffic.
- Platform-admin code can be isolated behind explicit repositories/services.

Cons:

- A `BYPASSRLS` role bypasses the database safety net entirely.
- Requires a second pool, second secret, and stricter operational controls.
- Harder to prove in tests that every access is audited because the database no longer enforces tenant predicates.

Effort estimate: 1-2 weeks, mostly due to infrastructure, secrets, and audit hardening.

## Pattern C: No Super-Admin In Phase 0

Defer platform-admin support. Early operations use direct database access through controlled infrastructure procedures.

Pros:

- Lowest Phase 0 complexity.
- Avoids adding a bypass before auth, permissions, and audit flows mature.
- Preserves the strict tenant-isolation model during foundation build.

Cons:

- No productized support console during early pilots.
- Operational access is manual and must be handled carefully.
- Later implementation still needs policy and audit work.

Effort estimate: 0 dev days in Phase 0; 3-10 dev days later depending on chosen model.

## Recommendation

Choose Pattern A after M5 auth is in place.

Reasoning: transaction-scoped session variables match the locked RLS architecture and keep platform-admin access inside the same request/audit pipeline as normal tenant traffic. The implementation should require a platform-admin JWT claim, `SET LOCAL app.is_platform_admin = 'true'`, and mandatory audit-log records for every platform-admin read or write.

Do not implement Pattern B unless there is a strong operational requirement for DB-role separation. Avoid `BYPASSRLS` for application traffic unless PM explicitly accepts the increased blast radius.

M4 stops here and does not implement any super-admin bypass.
