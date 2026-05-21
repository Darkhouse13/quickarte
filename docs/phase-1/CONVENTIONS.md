# Phase 1 Engineering Conventions

## API Contract And SDK

Every new API endpoint ships with both sides of the contract typed:

- Request DTOs are class-validator classes and are used as controller `@Body()` / `@Query()` inputs.
- Response DTOs use `@ApiProperty` / `@ApiPropertyOptional` and are wired through `@ApiResponse({ type: ... })`.
- Path parameters that appear in URLs use `@ApiParam`.
- The OpenAPI SDK in `packages/shared-types` is regenerated and committed in the same milestone as the endpoint.

Admin web and POS terminal must consume the generated SDK directly. Do not add `as unknown as` casts for API calls in client apps. If a cast seems necessary, the OpenAPI schema is incomplete; fix the DTOs and controller decorators instead of weakening the call site.

## Zod DTOs For Module 3+

Phase 0 and Module 2 endpoints keep the existing class-validator request DTO and `@ApiProperty` response DTO pattern. Do not retrofit those endpoints just to use Zod.

For new Module 3+ endpoints, Zod DTOs are permitted when they follow this pattern:

- Define reusable Zod schemas next to the feature module.
- Create Nest DTO classes with `createZodDto`.
- Wire request DTOs through Nest route parameters such as `@Body()`, `@Query()`, or `@Param()` with `ZodValidationPipe`.
- Wire response DTOs with `ZodResponse({ type: ResponseDto })` or an equivalent `nestjs-zod` decorator that produces precise OpenAPI response schemas.
- Run `cleanupOpenApiDoc(..., { version: "3.1" })` when generating Swagger/OpenAPI.
- Regenerate and commit the SDK in the same milestone.
- Prove nested response types in `packages/shared-types` are precise; no `any` and no `as unknown as` client casts.

Money fields in Zod schemas must be decimal strings:

```ts
const decimalStringSchema = z.string().regex(/^-?\d+(\.\d{1,2})?$/);
```

Do not use `z.number()` for prices, totals, subtotals, tax amounts, discounts, tips, service-charge amounts, or any other currency-denominated value. `drizzle-zod` numeric output must be checked and overridden where needed so generated OpenAPI and SDK types stay `string`.

## Tenant And Branch Scope

`business_id` remains the RLS tenant key. `branch_id` is a filtering and authorization dimension, never a tenant key. New tenant-scoped tables must include strict RLS in the same migration that creates them.

## Milestone Reporting

Every milestone report pastes the verbatim files the PM requested in that milestone's prompt, in fenced code blocks with file-path headers. A report without the requested files is an incomplete milestone and is sent back before review begins. This is not optional.

## Money And Numeric Values

Money values — prices, totals, subtotals, tax amounts, discounts, tips, service-charge amounts, any value denominated in currency — are stored as Postgres `numeric` and represented across the API as STRINGS (decimal strings like "42.50"), never as JavaScript floating-point numbers. All money arithmetic (summing line items, computing tax, applying discounts, computing change) happens server-side using decimal-safe math (integer minor units i.e. centimes, or a decimal library), NEVER client-side float math and NEVER with JS `+`/`*` on float dollars. Rationale: JS floats cannot represent decimal currency exactly (0.1 + 0.2 !== 0.3); float money math produces receipts and Z-reports that fail to reconcile and invoices that fail DGI compliance.

Percentages and rates that are NOT themselves summed into money totals — tax rate, service-charge rate — MAY be represented as numbers, since they are multipliers applied server-side, not accumulated currency values.

When Module 3 (menu prices) and Module 6 (order totals) are built, prices and computed amounts are decimal strings on the wire and decimal-safe integers/library values in computation. This is not optional and is the single most important data-handling rule in the system.
