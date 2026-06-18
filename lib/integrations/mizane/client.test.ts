import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { MizaneError, getMizaneMenu, getMizaneOrderStatus } from "./client";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(impl: typeof fetch) {
  globalThis.fetch = impl as typeof fetch;
}

describe("mizaneFetch error mapping", () => {
  it("maps an AbortError (timeout) to MizaneError code 'timeout'", async () => {
    stubFetch(async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    });

    await assert.rejects(
      () => getMizaneOrderStatus("key", "order-1"),
      (err: unknown) => {
        assert.ok(err instanceof MizaneError);
        assert.equal(err.code, "timeout");
        assert.equal(err.status, 0);
        return true;
      },
    );
  });

  it("maps a generic network failure to MizaneError code 'network'", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });

    await assert.rejects(
      () => getMizaneOrderStatus("key", "order-1"),
      (err: unknown) => {
        assert.ok(err instanceof MizaneError);
        assert.equal(err.code, "network");
        return true;
      },
    );
  });

  it("surfaces the API error envelope code and message", async () => {
    stubFetch(async () =>
      new Response(
        JSON.stringify({
          error: { code: "order_not_found", message: "No such order", details: null },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ),
    );

    await assert.rejects(
      () => getMizaneOrderStatus("key", "missing"),
      (err: unknown) => {
        assert.ok(err instanceof MizaneError);
        assert.equal(err.status, 404);
        assert.equal(err.code, "order_not_found");
        assert.equal(err.message, "No such order");
        return true;
      },
    );
  });

  it("treats a 409 idempotent replay as success", async () => {
    stubFetch(async () =>
      new Response(
        JSON.stringify({ orderNumber: "ORD-1", status: "pending_confirmation", total: "10.00" }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await getMizaneOrderStatus("key", "dup");
    assert.equal(result.orderNumber, "ORD-1");
    assert.equal(result.status, "pending_confirmation");
  });
});

describe("getMizaneMenu conditional fetch", () => {
  const MENU_BODY = JSON.stringify({
    currency: "MAD",
    categories: [],
    products: [],
    variants: [],
    optionGroups: [],
    productOptionGroups: [],
  });

  it("sends If-None-Match when given a cached etag", async () => {
    let sentHeader: string | null = null;
    stubFetch(async (_url, init) => {
      sentHeader = new Headers(init?.headers).get("If-None-Match");
      return new Response(MENU_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json", ETag: '"new"' },
      });
    });

    const result = await getMizaneMenu("key", '"cached"');
    assert.equal(sentHeader, '"cached"');
    assert.equal(result.notModified, false);
    assert.equal(result.etag, '"new"');
  });

  it("returns notModified with the etag on a 304", async () => {
    stubFetch(async () =>
      new Response(null, {
        status: 304,
        headers: { ETag: '"cached"' },
      }),
    );

    const result = await getMizaneMenu("key", '"cached"');
    assert.equal(result.notModified, true);
    assert.equal(result.etag, '"cached"');
  });

  it("omits If-None-Match on a first sync (no cached etag)", async () => {
    let hadHeader = true;
    stubFetch(async (_url, init) => {
      hadHeader = new Headers(init?.headers).has("If-None-Match");
      return new Response(MENU_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json", ETag: '"first"' },
      });
    });

    const result = await getMizaneMenu("key");
    assert.equal(hadHeader, false);
    assert.equal(result.notModified, false);
    assert.equal(result.etag, '"first"');
  });
});
