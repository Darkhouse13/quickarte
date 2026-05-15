import test from "node:test";
import assert from "node:assert/strict";
import type { BusinessDayBounds } from "@/lib/business/business-day";
import type { StaffRole } from "@/lib/identity/permissions";
import { handleCloseExport, type CloseExportDeps } from "./close-of-day-export";
import type { DailyClose } from "./close-of-day";
import type {
  OrderListItem,
  OrderListItemFilters,
} from "./close-of-day-orders";

const businessId = "11111111-1111-4111-8111-111111111111";

test("handleCloseExport returns 401 when the merchant session is missing", async () => {
  const response = await handleCloseExport(
    request("https://quickarte.test/api/cloture/export?date=2026-05-14"),
    depsForRole(null),
  );

  assert.equal(response.status, 401);
});

test("handleCloseExport returns 403 for waiter and kitchen roles", async () => {
  for (const role of ["waiter", "kitchen"] satisfies StaffRole[]) {
    const response = await handleCloseExport(
      request("https://quickarte.test/api/cloture/export?date=2026-05-14"),
      depsForRole(role),
    );

    assert.equal(response.status, 403);
    assert.match(await response.text(), /Accès refusé/);
  }
});

test("handleCloseExport returns 400 with a French body for bad date format", async () => {
  const response = await handleCloseExport(
    request("https://quickarte.test/api/cloture/export?date=14-05-2026"),
    depsForRole("cashier"),
  );

  assert.equal(response.status, 400);
  assert.equal(await response.text(), "Date invalide. Utilisez le format AAAA-MM-JJ.");
});

test("handleCloseExport passes statusIn and tableNumberQuery to the order list", async () => {
  let capturedFilters: OrderListItemFilters | null = null;
  const response = await handleCloseExport(
    request(
      "https://quickarte.test/api/cloture/export?date=2026-05-14&statusIn=ready&tableNumberQuery=12",
    ),
    depsForRole("manager", {
      getOrdersForDay: async (_businessId, _bounds, filters) => {
        capturedFilters = filters ?? {};
        return [exportOrder()];
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedFilters, {
    statusIn: ["ready"],
    posStatus: undefined,
    tableNumberQuery: "12",
  });
  assert.equal(
    response.headers.get("Content-Disposition"),
    'attachment; filename="quickarte-cloture-snack-atlas-2026-05-14.csv"',
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
});

test("handleCloseExport passes posStatus to the order list", async () => {
  let capturedFilters: OrderListItemFilters | null = null;
  const response = await handleCloseExport(
    request(
      "https://quickarte.test/api/cloture/export?date=2026-05-14&posStatus=pending",
    ),
    depsForRole("manager", {
      getCurrentBusiness: async () => ({
        session: { user: { id: "user-1" } },
        business: {
          id: businessId,
          slug: "snack-atlas",
          timezone: "Africa/Casablanca",
          settings: { posCoexistenceEnabled: true },
        },
      }),
      getOrdersForDay: async (_businessId, _bounds, filters) => {
        capturedFilters = filters ?? {};
        return [{ ...exportOrder(), posStatus: "pending" }];
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedFilters, {
    statusIn: undefined,
    posStatus: "pending",
    tableNumberQuery: undefined,
  });
  assert.match(await response.text(), /À entrer/);
});

function depsForRole(
  role: StaffRole | null,
  overrides: Partial<CloseExportDeps> = {},
): CloseExportDeps {
  return {
    getCurrentBusiness: async () =>
      role === null
        ? null
        : {
            session: { user: { id: "user-1" } },
            business: {
              id: businessId,
              slug: "snack-atlas",
              timezone: "Africa/Casablanca",
            },
          },
    assertRole: async (_userId, _businessId, allowed) => {
      if (!role || !allowed.includes(role)) throw new Error("Forbidden");
      return role;
    },
    getDailyClose: async (_businessId, bounds) => dailyClose(bounds),
    getOrdersForDay: async () => [exportOrder()],
    ...overrides,
  };
}

function request(url: string): Request {
  return new Request(url, { method: "GET" });
}

function dailyClose(bounds: BusinessDayBounds): DailyClose {
  return {
    date: bounds,
    totals: {
      orderCount: 1,
      revenueMad: 55,
      averageTicketMad: 55,
      cancelledCount: 0,
    },
    byType: {
      dine_in: { count: 1, revenueMad: 55 },
      takeaway: { count: 0, revenueMad: 0 },
      delivery: { count: 0, revenueMad: 0 },
    },
    byStatus: {
      pending: 0,
      preparing: 0,
      ready: 1,
      completed: 0,
      cancelled: 0,
    },
    comparison: {
      lastWeekRevenueMad: 0,
      lastWeekOrderCount: 0,
    },
  };
}

function exportOrder(): OrderListItem {
  return {
    id: "abcd1200-1111-4111-8111-111111111111",
    shortRef: "ABCD12",
    createdAt: new Date("2026-05-14T08:00:00.000Z"),
    type: "dine_in",
    tableNumber: "12",
    status: "ready",
    posStatus: "entered",
    posReference: "BC-1408",
    totalMad: 55,
    itemsSummary: "1x Tacos Atlas",
    customerPhone: null,
    customerNote: null,
  };
}
