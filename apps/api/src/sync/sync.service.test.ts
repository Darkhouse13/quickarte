import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { SyncService } from "./sync.service";

test("push rejects tables outside the M6 audit_log sync surface", async () => {
  const service = new SyncService(
    {} as ConstructorParameters<typeof SyncService>[0],
    {} as ConstructorParameters<typeof SyncService>[1],
  );

  await assert.rejects(
    () =>
      service.push("11111111-1111-4111-8111-111111111111", {
        orders: { created: [], updated: [], deleted: [] },
      }),
    (error) =>
      error instanceof BadRequestException &&
      JSON.stringify(error.getResponse()).includes("sync-table-not-allowed"),
  );
});
