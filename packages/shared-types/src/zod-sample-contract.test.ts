import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

test("test-only zod sample endpoint is not exposed in generated OpenAPI", () => {
  const openApiPath = resolve(process.cwd(), "openapi.json");
  const document = JSON.parse(readFileSync(openApiPath, "utf8")) as {
    paths?: Record<string, unknown>;
  };

  assert.equal(document.paths?.["/v1/_samples/effective-menu"], undefined);
});
