import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  branchClosedDays,
  branchOperatingHours,
  branchPaymentMethods,
  branchScheduleSettings,
  branches,
  businesses,
  permissionVersions,
  permissions,
  rolePermissions,
  roles,
  users,
} from "@quickarte/db-schema";
import * as schema from "@quickarte/db-schema";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { ApiJwtService } from "../src/auth/jwt.strategy";
import { ProblemDetailsFilter } from "../src/common/filters/problem-details.filter";
import { DatabaseService } from "../src/database/database.service";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgres://quickarte:quickarte@localhost:5433/quickarte";
const appRoleUrl =
  process.env.TEST_APP_DATABASE_URL ??
  "postgres://quickarte_rls_test:quickarte_rls_test@localhost:5433/quickarte";
const migrationsFolder = "../../packages/db-schema/migrations";

let adminPool: Pool;
let adminDb: ReturnType<typeof drizzle<typeof schema>>;
let appPool: Pool;
let appDb: ReturnType<typeof drizzle<typeof schema>>;
let databaseService: DatabaseService;
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let baseUrl: string;
let jwtService: ApiJwtService;
let businessAId: string;
let businessBId: string;
let branchAId: string;
let branchBId: string;
let userAId: string;
let userBId: string;
let ownerRoleAId: string;
let ownerRoleBId: string;

before(async () => {
  process.env.DATABASE_URL = appRoleUrl;
  process.env.JWT_SECRET = "test-secret-test-secret-test-secret-test";
  process.env.JWT_ISSUER = "http://localhost:3001";
  process.env.JWT_AUDIENCE = "quickarte-api";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.LOG_LEVEL = "silent";
  process.env.NODE_ENV = "test";

  adminPool = new Pool({ connectionString: databaseUrl });
  adminDb = drizzle(adminPool, { schema });
  await migrate(adminDb, { migrationsFolder });

  await adminDb.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quickarte_rls_test') THEN
        CREATE ROLE quickarte_rls_test LOGIN PASSWORD 'quickarte_rls_test' NOSUPERUSER NOBYPASSRLS;
      END IF;
    END
    $$;
  `);
  await adminDb.execute(sql`ALTER ROLE quickarte_rls_test WITH NOSUPERUSER NOBYPASSRLS`);
  await adminDb.execute(sql`GRANT USAGE ON SCHEMA public TO quickarte_rls_test`);
  await adminDb.execute(sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO quickarte_rls_test`);

  appPool = new Pool({ connectionString: appRoleUrl });
  appDb = drizzle(appPool, { schema });
  databaseService = new DatabaseService(appPool, appDb);

  const runId = randomUUID();
  businessAId = randomUUID();
  businessBId = randomUUID();
  userAId = randomUUID();
  userBId = randomUUID();

  await adminDb.insert(users).values([
    { id: userAId, name: "Settings Owner A", email: `settings-a-${runId}@example.test`, role: "owner" },
    { id: userBId, name: "Settings Owner B", email: `settings-b-${runId}@example.test`, role: "owner" },
  ]);
  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: userAId,
      name: "Settings Tenant A",
      slug: `settings-a-${runId}`,
      type: "restaurant",
    },
    {
      id: businessBId,
      ownerId: userBId,
      name: "Settings Tenant B",
      slug: `settings-b-${runId}`,
      type: "cafe",
    },
  ]);
  const [branchA] = await adminDb
    .insert(branches)
    .values({ businessId: businessAId, name: "Main A", slug: `main-a-${runId}`, isDefault: true })
    .returning({ id: branches.id });
  const [branchB] = await adminDb
    .insert(branches)
    .values({ businessId: businessBId, name: "Main B", slug: `main-b-${runId}`, isDefault: true })
    .returning({ id: branches.id });
  assert.ok(branchA);
  assert.ok(branchB);
  branchAId = branchA.id;
  branchBId = branchB.id;

  await seedRolesAndPermissions(businessAId);
  await seedRolesAndPermissions(businessBId);

  const { AppModule } = await import("../src/app.module");
  app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(0);
  jwtService = app.get(ApiJwtService);

  const address = app.getHttpServer().address();
  assert.equal(typeof address, "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await app?.close();
  await appPool?.end();
  await adminPool?.end();
});

test("M2.2 RLS isolates hours, closed days, settings, and payment methods", async (t) => {
  await databaseService.withTenant(businessAId, async (tx) => {
    await tx.insert(branchOperatingHours).values({
      businessId: businessAId,
      branchId: branchAId,
      scheduleType: "normal",
      dayOfWeek: 1,
      opensAt: "09:00",
      closesAt: "18:00",
      isClosed: false,
      position: 0,
    });
    await tx.insert(branchScheduleSettings).values({
      businessId: businessAId,
      branchId: branchAId,
      ramadanModeEnabled: true,
    });
    await tx.insert(branchClosedDays).values({
      businessId: businessAId,
      branchId: branchAId,
      date: "2026-07-30",
      reason: "Maintenance",
    });
    await tx.insert(branchPaymentMethods).values({
      businessId: businessAId,
      branchId: branchAId,
      methodCode: "cash",
      enabled: true,
      cashDrawerAutoOpen: true,
      sortOrder: 0,
    });
  });

  await t.test("tenant A can read only its own M2.2 rows", async () => {
    const rows = await databaseService.withTenant(businessAId, async (tx) => ({
      hours: await tx.select().from(branchOperatingHours),
      settings: await tx.select().from(branchScheduleSettings),
      closedDays: await tx.select().from(branchClosedDays),
      methods: await tx.select().from(branchPaymentMethods),
    }));
    assert.equal(rows.hours.every((row) => row.businessId === businessAId), true);
    assert.equal(rows.settings.every((row) => row.businessId === businessAId), true);
    assert.equal(rows.closedDays.every((row) => row.businessId === businessAId), true);
    assert.equal(rows.methods.every((row) => row.businessId === businessAId), true);
  });

  await t.test("tenant B forged predicates cannot read tenant A rows", async () => {
    const rows = await databaseService.withTenant(businessBId, async (tx) => ({
      hours: await tx
        .select()
        .from(branchOperatingHours)
        .where(eq(branchOperatingHours.businessId, businessAId)),
      settings: await tx
        .select()
        .from(branchScheduleSettings)
        .where(eq(branchScheduleSettings.businessId, businessAId)),
      closedDays: await tx
        .select()
        .from(branchClosedDays)
        .where(eq(branchClosedDays.businessId, businessAId)),
      methods: await tx
        .select()
        .from(branchPaymentMethods)
        .where(eq(branchPaymentMethods.businessId, businessAId)),
    }));
    assert.equal(rows.hours.length, 0);
    assert.equal(rows.settings.length, 0);
    assert.equal(rows.closedDays.length, 0);
    assert.equal(rows.methods.length, 0);
  });

  await t.test("direct app-role query without tenant context reads zero rows", async () => {
    assert.equal((await appDb.select().from(branchOperatingHours)).length, 0);
    assert.equal((await appDb.select().from(branchScheduleSettings)).length, 0);
    assert.equal((await appDb.select().from(branchClosedDays)).length, 0);
    assert.equal((await appDb.select().from(branchPaymentMethods)).length, 0);
  });

  await t.test("tenant A cannot insert payment config for tenant B", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(branchPaymentMethods).values({
          businessId: businessBId,
          branchId: branchBId,
          methodCode: "cmi_card",
          enabled: true,
          cashDrawerAutoOpen: false,
          sortOrder: 10,
        }),
      ),
      (error) =>
        /row-level security policy|violates row-level security/i.test(
          `${String(error)} ${String((error as { cause?: unknown }).cause)}`,
        ),
    );
  });
});

test("operating-hours endpoint atomically replaces branch schedules", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const putResponse = await apiJson(`/v1/branches/${branchAId}/operating-hours`, "PUT", token, {
    ramadanModeEnabled: true,
    normal: [
      { dayOfWeek: 1, opensAt: "08:00", closesAt: "12:00", isClosed: false, position: 0 },
      { dayOfWeek: 1, opensAt: "14:00", closesAt: "19:00", isClosed: false, position: 1 },
      { dayOfWeek: 0, opensAt: null, closesAt: null, isClosed: true, position: 0 },
    ],
    ramadan: [
      { dayOfWeek: 1, opensAt: "20:00", closesAt: "23:30", isClosed: false, position: 0 },
    ],
    closedDays: [{ date: "2026-08-14", reason: "Holiday" }],
  });
  const firstBody = await putResponse.json() as { normal: unknown[]; ramadan: unknown[]; closedDays: unknown[] };
  assert.equal(putResponse.status, 200, JSON.stringify(firstBody));
  assert.equal(firstBody.normal.length, 3);
  assert.equal(firstBody.ramadan.length, 1);
  assert.equal(firstBody.closedDays.length, 1);

  const replaceResponse = await apiJson(`/v1/branches/${branchAId}/operating-hours`, "PUT", token, {
    ramadanModeEnabled: false,
    normal: [{ dayOfWeek: 2, opensAt: "09:00", closesAt: "17:00", isClosed: false, position: 0 }],
    ramadan: [],
    closedDays: [],
  });
  const replaced = await replaceResponse.json() as { ramadanModeEnabled: boolean; normal: unknown[]; ramadan: unknown[]; closedDays: unknown[] };
  assert.equal(replaceResponse.status, 200, JSON.stringify(replaced));
  assert.equal(replaced.ramadanModeEnabled, false);
  assert.equal(replaced.normal.length, 1);
  assert.equal(replaced.ramadan.length, 0);
  assert.equal(replaced.closedDays.length, 0);

  const invalidClosedResponse = await apiJson(`/v1/branches/${branchAId}/operating-hours`, "PUT", token, {
    ramadanModeEnabled: false,
    normal: [{ dayOfWeek: 3, opensAt: "09:00", closesAt: null, isClosed: true, position: 0 }],
    ramadan: [],
    closedDays: [],
  });
  assert.equal(invalidClosedResponse.status, 400, await invalidClosedResponse.text());

  const tenantBToken = tokenFor(businessBId, userBId, ownerRoleBId);
  const forgedResponse = await apiGet(`/v1/branches/${branchAId}/operating-hours`, tenantBToken);
  assert.equal(forgedResponse.status, 404, await forgedResponse.text());
});

test("payment-method endpoints enforce definitions and built-in/custom constraints", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);

  const definitionsResponse = await apiGet("/v1/payment-method-definitions", token);
  const definitions = await definitionsResponse.json() as { definitions: Array<{ code: string }> };
  assert.equal(definitionsResponse.status, 200, JSON.stringify(definitions));
  assert.ok(definitions.definitions.some((definition) => definition.code === "cash"));
  assert.ok(definitions.definitions.some((definition) => definition.code === "cmi_card"));

  const putResponse = await apiJson(`/v1/branches/${branchAId}/payment-methods`, "PUT", token, {
    methods: [
      { methodCode: "cash", enabled: true, cashDrawerAutoOpen: true, sortOrder: 0 },
      { methodCode: "cmi_card", enabled: false, cashDrawerAutoOpen: false, sortOrder: 10 },
      { customName: "Bon maison", enabled: true, cashDrawerAutoOpen: false, sortOrder: 20 },
    ],
  });
  const putBody = await putResponse.json() as { methods: Array<{ methodCode: string | null; customName: string | null }> };
  assert.equal(putResponse.status, 200, JSON.stringify(putBody));
  assert.equal(putBody.methods.length, 3);

  const duplicateResponse = await apiJson(`/v1/branches/${branchAId}/payment-methods`, "PUT", token, {
    methods: [
      { methodCode: "cash", enabled: true, cashDrawerAutoOpen: true, sortOrder: 0 },
      { methodCode: "cash", enabled: false, cashDrawerAutoOpen: false, sortOrder: 1 },
    ],
  });
  assert.equal(duplicateResponse.status, 400, await duplicateResponse.text());

  const invalidShapeResponse = await apiJson(`/v1/branches/${branchAId}/payment-methods`, "PUT", token, {
    methods: [
      { methodCode: "cash", customName: "Cash custom", enabled: true, cashDrawerAutoOpen: false, sortOrder: 0 },
    ],
  });
  assert.equal(invalidShapeResponse.status, 400, await invalidShapeResponse.text());

  const tenantBToken = tokenFor(businessBId, userBId, ownerRoleBId);
  const forgedResponse = await apiGet(`/v1/branches/${branchAId}/payment-methods`, tenantBToken);
  assert.equal(forgedResponse.status, 404, await forgedResponse.text());
});

async function seedRolesAndPermissions(businessId: string): Promise<void> {
  const permissionIds = [
    "settings.view",
    "settings.update",
    "payment_methods.view",
    "payment_methods.update",
  ];

  await adminDb
    .insert(permissions)
    .values(
      permissionIds.map((id) => ({
        id,
        description: id,
        category: id.split(".")[0]!,
      })),
    )
    .onConflictDoNothing();

  await adminDb.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL app.current_business_id = '${businessId}'`));
    await tx.insert(permissionVersions).values({ businessId, version: 1 }).onConflictDoNothing();

    const [ownerRole] = await tx
      .insert(roles)
      .values({ businessId, name: "Owner", isSystem: true })
      .returning({ id: roles.id });
    assert.ok(ownerRole);
    if (businessId === businessAId) {
      ownerRoleAId = ownerRole.id;
    }
    if (businessId === businessBId) {
      ownerRoleBId = ownerRole.id;
    }

    await tx
      .insert(rolePermissions)
      .values(permissionIds.map((permissionId) => ({ roleId: ownerRole.id, permissionId })))
      .onConflictDoNothing();
  });
}

function tokenFor(businessId: string, userId: string, roleId: string): string {
  return jwtService.signAccessToken({
    sub: userId,
    business_id: businessId,
    role_id: roleId,
    permissions_version: 1,
    is_platform_admin: false,
  });
}

async function apiGet(path: string, token: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function apiJson(
  path: string,
  method: "PUT",
  token: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
