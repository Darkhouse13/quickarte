import assert from "node:assert/strict";
import { test } from "node:test";
import { auditLog } from "@quickarte/db-schema";
import { AuditLogService, type AuditLogInput } from "./audit-log.service";

test("recordAction inserts an audit log row", async () => {
  const inserted: unknown[] = [];
  const fakeDb = {
    insert(table: unknown) {
      assert.equal(table, auditLog);
      return {
        values(row: unknown) {
          inserted.push(row);
          return Promise.resolve();
        },
      };
    },
  };

  const service = new AuditLogService(fakeDb as never);
  const input: AuditLogInput = {
    businessId: "00000000-0000-4000-8000-000000000001",
    actorUserId: "00000000-0000-4000-8000-000000000002",
    action: "menu.item.created",
    entityType: "product",
    entityId: "00000000-0000-4000-8000-000000000003",
    beforeState: null,
    afterState: { name: "Tacos" },
    ipAddress: "127.0.0.1",
    userAgent: "node:test",
    requestId: "00000000-0000-4000-8000-000000000004",
  };

  await service.recordAction(input);

  assert.deepEqual(inserted, [
    {
      ...input,
      beforeState: null,
      createdAt: undefined,
    },
  ]);
});
