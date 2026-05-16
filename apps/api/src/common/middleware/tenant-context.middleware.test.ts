import assert from "node:assert/strict";
import { test } from "node:test";
import { TenantContextMiddleware, type TenantRequest } from "./tenant-context.middleware";

function createMiddleware() {
  return new TenantContextMiddleware(
    {
      verifyAccessToken: () => {
        throw new Error("JWT verification should not run in these tests");
      },
    } as never,
    {
      get: () => "development",
    } as never,
  );
}

test("tenant middleware attaches a valid X-Tenant-Id header to the request", () => {
  const middleware = createMiddleware();
  const request: TenantRequest = {
    headers: {
      "x-tenant-id": "00000000-0000-4000-8000-000000000001",
    },
  } as unknown as TenantRequest;
  let nextCalled = false;

  middleware.use(request as never, {} as never, (error?: unknown) => {
    assert.equal(error, undefined);
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(request.businessId, "00000000-0000-4000-8000-000000000001");
});

test("tenant middleware rejects missing tenant context", () => {
  const middleware = createMiddleware();

  middleware.use({ headers: {} } as never, {} as never, (error?: unknown) => {
    assert.equal(error?.constructor.name, "UnauthorizedException");
    assert.match(String((error as Error).message), /Authorization bearer token is required/);
  });
});

test("tenant middleware rejects malformed tenant context", () => {
  const middleware = createMiddleware();

  middleware.use(
    { headers: { "x-tenant-id": "not-a-uuid" } } as never,
    {} as never,
    (error?: unknown) => {
      assert.equal(error?.constructor.name, "BadRequestException");
      assert.match(String((error as Error).message), /Tenant context is invalid/);
    },
  );
});
