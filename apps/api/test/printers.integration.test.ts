import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  branches,
  businesses,
  permissionVersions,
  permissions,
  printJobs,
  printerAssignments,
  printers,
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
let printerAId: string;
let printerBId: string;

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
    { id: userAId, name: "Printer Owner A", email: `printer-a-${runId}@example.test`, role: "owner" },
    { id: userBId, name: "Printer Owner B", email: `printer-b-${runId}@example.test`, role: "owner" },
  ]);
  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: userAId,
      name: "Printer Tenant A",
      slug: `printer-a-${runId}`,
      type: "restaurant",
    },
    {
      id: businessBId,
      ownerId: userBId,
      name: "Printer Tenant B",
      slug: `printer-b-${runId}`,
      type: "cafe",
    },
  ]);

  const [branchA] = await adminDb
    .insert(branches)
    .values({
      businessId: businessAId,
      name: "Printer Branch A",
      slug: `printer-main-a-${runId}`,
      isDefault: true,
    })
    .returning({ id: branches.id });
  const [branchB] = await adminDb
    .insert(branches)
    .values({
      businessId: businessBId,
      name: "Printer Branch B",
      slug: `printer-main-b-${runId}`,
      isDefault: true,
    })
    .returning({ id: branches.id });
  assert.ok(branchA);
  assert.ok(branchB);
  branchAId = branchA.id;
  branchBId = branchB.id;

  await seedRolesAndPermissions(businessAId);
  await seedRolesAndPermissions(businessBId);

  const [printerA] = await adminDb
    .insert(printers)
    .values({
      businessId: businessAId,
      branchId: branchAId,
      name: "Tenant A Printer",
      station: "counter",
      connectionType: "webprint",
      webprintToken: `token-${runId}-a`,
      enabled: true,
    })
    .returning({ id: printers.id });
  const [printerB] = await adminDb
    .insert(printers)
    .values({
      businessId: businessBId,
      branchId: branchBId,
      name: "Tenant B Printer",
      station: "counter",
      connectionType: "manual",
      enabled: true,
    })
    .returning({ id: printers.id });
  assert.ok(printerA);
  assert.ok(printerB);
  printerAId = printerA.id;
  printerBId = printerB.id;

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

test("M2.5 RLS isolates printer assignments", async (t) => {
  await databaseService.withTenant(businessAId, async (tx) => {
    await tx.insert(printerAssignments).values({
      businessId: businessAId,
      branchId: branchAId,
      printerId: printerAId,
      role: "receipt",
      priority: 0,
      enabled: true,
    });
  });

  await t.test("tenant A can read only its own assignments", async () => {
    const rows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(printerAssignments),
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.businessId, businessAId);
  });

  await t.test("tenant B forged predicates cannot read tenant A assignments", async () => {
    const rows = await databaseService.withTenant(businessBId, (tx) =>
      tx
        .select()
        .from(printerAssignments)
        .where(eq(printerAssignments.businessId, businessAId)),
    );
    assert.equal(rows.length, 0);
  });

  await t.test("direct app-role query without tenant context reads zero rows", async () => {
    assert.equal((await appDb.select().from(printerAssignments)).length, 0);
  });

  await t.test("tenant A cannot insert a tenant B assignment", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(printerAssignments).values({
          businessId: businessBId,
          branchId: branchBId,
          printerId: printerBId,
          role: "kitchen",
          priority: 0,
          enabled: true,
        }),
      ),
      (error) =>
        /row-level security policy|violates row-level security/i.test(
          `${String(error)} ${String((error as { cause?: unknown }).cause)}`,
        ),
    );
  });
});

test("printer API filters the shared printers table by business_id and branch_id", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);
  const tokenB = tokenFor(businessBId, userBId, ownerRoleBId);

  const listA = await apiGet(`/v1/branches/${branchAId}/printers`, tokenA);
  const listABody = (await listA.json()) as {
    printers: Array<{ id: string; businessId: string }>;
  };
  assert.equal(listA.status, 200, JSON.stringify(listABody));
  assert.ok(listABody.printers.some((printer) => printer.id === printerAId));
  assert.ok(listABody.printers.every((printer) => printer.businessId === businessAId));

  const forgedBranch = await apiGet(`/v1/branches/${branchAId}/printers`, tokenB);
  assert.equal(forgedBranch.status, 404, await forgedBranch.text());

  const forgedPrinterUpdate = await apiJson(
    `/v1/branches/${branchBId}/printers/${printerAId}`,
    "PATCH",
    tokenB,
    { name: "Cross-tenant overwrite" },
  );
  assert.equal(forgedPrinterUpdate.status, 404, await forgedPrinterUpdate.text());

  const [unchanged] = await adminDb
    .select({ name: printers.name })
    .from(printers)
    .where(eq(printers.id, printerAId));
  assert.equal(unchanged?.name, "Tenant A Printer");
});

test("printer CRUD, assignment replacement, and test print enqueue work", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);

  const createResponse = await apiJson(`/v1/branches/${branchAId}/printers`, "POST", tokenA, {
    name: "Comptoir API",
    connectionType: "bluetooth",
    address: "AA:BB:CC",
    model: "Generic BT",
    notes: "Device-local Bluetooth support is deferred",
    enabled: true,
  });
  const created = (await createResponse.json()) as {
    id: string;
    branchId: string;
    connectionType: string;
  };
  assert.equal(createResponse.status, 201, JSON.stringify(created));
  assert.equal(created.branchId, branchAId);
  assert.equal(created.connectionType, "bluetooth");

  const updateResponse = await apiJson(
    `/v1/branches/${branchAId}/printers/${created.id}`,
    "PATCH",
    tokenA,
    { name: "Comptoir principal", model: "M2", enabled: true },
  );
  const updated = (await updateResponse.json()) as { name: string; model: string };
  assert.equal(updateResponse.status, 200, JSON.stringify(updated));
  assert.equal(updated.name, "Comptoir principal");
  assert.equal(updated.model, "M2");

  const badFallback = await apiJson(
    `/v1/branches/${branchAId}/printer-assignments`,
    "PUT",
    tokenA,
    {
      assignments: [
        {
          role: "receipt",
          printerId: created.id,
          fallbackPrinterId: created.id,
          priority: 0,
          enabled: true,
        },
      ],
    },
  );
  assert.equal(badFallback.status, 400, await badFallback.text());

  const assignmentResponse = await apiJson(
    `/v1/branches/${branchAId}/printer-assignments`,
    "PUT",
    tokenA,
    {
      assignments: [
        {
          role: "receipt",
          printerId: created.id,
          fallbackPrinterId: printerAId,
          priority: 0,
          enabled: true,
        },
        {
          role: "kitchen",
          printerId: printerAId,
          fallbackPrinterId: null,
          priority: 1,
          enabled: true,
        },
      ],
    },
  );
  const assignments = (await assignmentResponse.json()) as {
    assignments: Array<{ role: string; printerId: string; fallbackPrinterId: string | null }>;
  };
  assert.equal(assignmentResponse.status, 200, JSON.stringify(assignments));
  assert.equal(assignments.assignments.length, 2);
  assert.ok(assignments.assignments.some((assignment) => assignment.role === "receipt"));

  const testPrintResponse = await apiJson(
    `/v1/branches/${branchAId}/printers/${created.id}/test-print`,
    "POST",
    tokenA,
    {},
  );
  const testPrint = (await testPrintResponse.json()) as {
    jobId: string;
    queued: boolean;
    lastTestPrintAt: string;
  };
  assert.equal(testPrintResponse.status, 201, JSON.stringify(testPrint));
  assert.equal(testPrint.queued, true);

  const [job] = await adminDb
    .select()
    .from(printJobs)
    .where(eq(printJobs.id, testPrint.jobId));
  assert.ok(job);
  assert.equal(job.orderId, null);
  assert.equal(job.printerId, created.id);
  assert.match(job.payloadText, /TEST D'IMPRESSION/);

  const [printer] = await adminDb
    .select({ lastTestPrintAt: printers.lastTestPrintAt })
    .from(printers)
    .where(eq(printers.id, created.id));
  assert.ok(printer?.lastTestPrintAt);

  const deleteResponse = await fetch(
    `${baseUrl}/v1/branches/${branchAId}/printers/${created.id}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA}` },
    },
  );
  assert.equal(deleteResponse.status, 200, await deleteResponse.text());
});

async function seedRolesAndPermissions(businessId: string): Promise<void> {
  const permissionIds = ["printer.view", "printer.manage"];

  await adminDb
    .insert(permissions)
    .values(
      permissionIds.map((id) => ({
        id,
        description: id,
        category: "printer",
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
  method: "PATCH" | "POST" | "PUT",
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

