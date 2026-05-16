import assert from "node:assert/strict";
import { test } from "node:test";
import type { paths } from "./api";

type HasHealthPath = "/v1/health" extends keyof paths ? true : false;

test("generated OpenAPI paths include /v1/health", () => {
  const hasHealthPath: HasHealthPath = true;
  assert.equal(hasHealthPath, true);
});
