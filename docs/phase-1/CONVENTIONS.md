# Phase 1 Engineering Conventions

## API Contract And SDK

Every new API endpoint ships with both sides of the contract typed:

- Request DTOs are class-validator classes and are used as controller `@Body()` / `@Query()` inputs.
- Response DTOs use `@ApiProperty` / `@ApiPropertyOptional` and are wired through `@ApiResponse({ type: ... })`.
- Path parameters that appear in URLs use `@ApiParam`.
- The OpenAPI SDK in `packages/shared-types` is regenerated and committed in the same milestone as the endpoint.

Admin web and POS terminal must consume the generated SDK directly. Do not add `as unknown as` casts for API calls in client apps. If a cast seems necessary, the OpenAPI schema is incomplete; fix the DTOs and controller decorators instead of weakening the call site.

## Tenant And Branch Scope

`business_id` remains the RLS tenant key. `branch_id` is a filtering and authorization dimension, never a tenant key. New tenant-scoped tables must include strict RLS in the same migration that creates them.

## Milestone Reporting

Every milestone report pastes the verbatim files the PM requested in that milestone's prompt, in fenced code blocks with file-path headers. A report without the requested files is an incomplete milestone and is sent back before review begins. This is not optional.
