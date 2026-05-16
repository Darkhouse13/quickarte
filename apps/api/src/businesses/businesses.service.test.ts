import assert from "node:assert/strict";
import { test } from "node:test";
import { businesses } from "@quickarte/db-schema";
import { BusinessesService } from "./businesses.service";

test("findCurrent queries the current business inside withTenant", async () => {
  const businessId = "00000000-0000-4000-8000-000000000001";
  const row = { id: businessId, name: "Cafe Atlas" };
  const tenantContexts: string[] = [];
  const fakeDatabaseService = {
    withTenant(id: string, callback: (tx: unknown) => Promise<unknown>) {
      tenantContexts.push(id);
      const fakeTx = {
        query: {
          businesses: {
            findFirst(input: unknown) {
              assert.deepEqual(Object.keys(input as object), ["where"]);
              return Promise.resolve(row);
            },
          },
        },
      };
      return callback(fakeTx);
    },
  };

  const service = new BusinessesService(fakeDatabaseService as never);
  const result = await service.findCurrent(businessId);

  assert.equal(result, row);
  assert.deepEqual(tenantContexts, [businessId]);
  assert.equal(businesses.id.name, "id");
});
