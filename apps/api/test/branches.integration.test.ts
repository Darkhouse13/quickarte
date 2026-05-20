import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  branches,
  businessLegalProfiles,
  businesses,
  permissionVersions,
  permissions,
  rolePermissions,
  roles,
  users,
} from "@quickarte/db-schema";
import * as schema from "@quickarte/db-schema";
import { eq, inArray, sql } from "drizzle-orm";
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
let ownerRoleAId: string;
let ownerRoleBId: string;
let userAId: string;
let userBId: string;

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
    { id: userAId, name: "Branch Owner A", email: `branch-a-${runId}@example.test`, role: "owner" },
    { id: userBId, name: "Branch Owner B", email: `branch-b-${runId}@example.test`, role: "owner" },
  ]);

  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: userAId,
      name: "Branch Tenant A",
      slug: `branch-a-${runId}`,
      type: "restaurant",
      city: "Casablanca",
      address: "12 Rue A",
      formattedAddress: "12 Rue A, Casablanca",
      googlePlaceId: `place-a-${runId}`,
      lat: "33.5731000",
      lng: "-7.5898000",
      logo: "https://example.test/a.png",
    },
    {
      id: businessBId,
      ownerId: userBId,
      name: "Branch Tenant B",
      slug: `branch-b-${runId}`,
      type: "cafe",
      city: "Rabat",
      address: "22 Rue B",
    },
  ]);

  await adminDb.execute(sql`
    INSERT INTO "branches" (
      "business_id",
      "name",
      "slug",
      "is_default",
      "address_line1",
      "city",
      "google_place_id",
      "formatted_address",
      "lat",
      "lng",
      "logo",
      "created_at",
      "updated_at"
    )
    SELECT
      "id",
      "name",
      'main',
      true,
      "address",
      "city",
      "google_place_id",
      "formatted_address",
      "lat",
      "lng",
      "logo",
      now(),
      now()
    FROM "businesses" b
    WHERE "id" IN (${businessAId}, ${businessBId})
      AND NOT EXISTS (
        SELECT 1
        FROM "branches" existing
        WHERE existing."business_id" = b."id"
          AND existing."is_default" = true
          AND existing."deleted_at" IS NULL
      )
    ON CONFLICT ("business_id", "slug") DO NOTHING
  `);

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

test("default branch data migration creates one default branch per existing business", async () => {
  const seeded = await adminDb
    .select()
    .from(branches)
    .where(inArray(branches.businessId, [businessAId, businessBId]));

  const tenantA = seeded.filter((branch) => branch.businessId === businessAId);
  const tenantB = seeded.filter((branch) => branch.businessId === businessBId);
  assert.equal(tenantA.length, 1);
  assert.equal(tenantB.length, 1);
  assert.equal(tenantA[0]?.isDefault, true);
  assert.equal(tenantA[0]?.slug, "main");
  assert.equal(tenantA[0]?.name, "Branch Tenant A");
  assert.equal(tenantA[0]?.city, "Casablanca");
  assert.equal(tenantA[0]?.addressLine1, "12 Rue A");
  assert.equal(tenantA[0]?.currency, null);
  assert.equal(tenantA[0]?.timezone, null);
  assert.equal(tenantA[0]?.locale, null);
});

test("branches and business_legal_profiles RLS isolate tenants", async (t) => {
  const [tenantABranch] = await databaseService.withTenant(businessAId, (tx) =>
    tx
      .insert(branches)
      .values({
        businessId: businessAId,
        name: "Tenant A Branch",
        slug: `tenant-a-${randomUUID()}`,
      })
      .returning(),
  );
  assert.ok(tenantABranch);

  await databaseService.withTenant(businessAId, (tx) =>
    tx.insert(businessLegalProfiles).values({
      businessId: businessAId,
      legalName: "Tenant A Legal SARL",
    }),
  );

  await t.test("tenant A reads only tenant A branches", async () => {
    const rows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(branches).where(eq(branches.businessId, businessAId)),
    );
    assert.ok(rows.length >= 1);
    assert.ok(rows.every((row) => row.businessId === businessAId));
  });

  await t.test("tenant B cannot read tenant A branch by forged predicate", async () => {
    const rows = await databaseService.withTenant(businessBId, (tx) =>
      tx.select().from(branches).where(eq(branches.businessId, businessAId)),
    );
    assert.equal(rows.length, 0);
  });

  await t.test("direct query without tenant context reads no RLS-protected rows", async () => {
    const branchRows = await appDb.select().from(branches);
    const legalRows = await appDb.select().from(businessLegalProfiles);
    assert.equal(branchRows.length, 0);
    assert.equal(legalRows.length, 0);
  });

  await t.test("tenant A cannot insert a branch for tenant B", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(branches).values({
          businessId: businessBId,
          name: "Forged Branch",
          slug: `forged-${randomUUID()}`,
        }),
      ),
      (error) =>
        /row-level security policy|violates row-level security/i.test(
          `${String(error)} ${String((error as { cause?: unknown }).cause)}`,
        ),
    );
  });

  await t.test("tenant B cannot update tenant A legal profile", async () => {
    const rows = await databaseService.withTenant(businessBId, (tx) =>
      tx
        .update(businessLegalProfiles)
        .set({ legalName: "Forged Legal Name" })
        .where(eq(businessLegalProfiles.businessId, businessAId))
        .returning(),
    );
    assert.equal(rows.length, 0);
  });
});

test("branch CRUD endpoints enforce default-branch rules", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);

  const setupResponse = await apiGet("/v1/businesses/me/setup", token);
  const setup = await setupResponse.json() as { defaultBranch: { id: string; slug: string } };
  assert.equal(setupResponse.status, 200, JSON.stringify(setup));
  assert.equal(setup.defaultBranch.slug, "main");

  const createdResponse = await apiJson("/v1/branches", "POST", token, {
    name: "Maarif",
    slug: `maarif-${randomUUID()}`,
    city: "Casablanca",
    seatingCapacity: 64,
  });
  const created = await createdResponse.json() as { id: string; name: string; isDefault: boolean };
  assert.equal(createdResponse.status, 201, JSON.stringify(created));
  assert.equal(created.name, "Maarif");
  assert.equal(created.isDefault, false);

  const listResponse = await apiGet("/v1/branches", token);
  const list = await listResponse.json() as { branches: Array<{ id: string }> };
  assert.equal(listResponse.status, 200, JSON.stringify(list));
  assert.ok(list.branches.some((branch) => branch.id === created.id));

  const getResponse = await apiGet(`/v1/branches/${created.id}`, token);
  assert.equal(getResponse.status, 200, await getResponse.text());

  const updateResponse = await apiJson(`/v1/branches/${created.id}`, "PATCH", token, {
    name: "Maarif Updated",
    seatingCapacity: 72,
  });
  const updated = await updateResponse.json() as { name: string; seatingCapacity: number };
  assert.equal(updateResponse.status, 200, JSON.stringify(updated));
  assert.equal(updated.name, "Maarif Updated");
  assert.equal(updated.seatingCapacity, 72);

  const defaultResponse = await apiJson(`/v1/branches/${created.id}/set-default`, "POST", token, {});
  const newDefault = await defaultResponse.json() as { id: string; isDefault: boolean };
  assert.equal(defaultResponse.status, 200, JSON.stringify(newDefault));
  assert.equal(newDefault.id, created.id);
  assert.equal(newDefault.isDefault, true);

  const deleteDefaultResponse = await fetch(`${baseUrl}/v1/branches/${created.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const deleteDefaultProblem = await deleteDefaultResponse.json() as { type: string };
  assert.equal(deleteDefaultResponse.status, 409, JSON.stringify(deleteDefaultProblem));
  assert.equal(deleteDefaultProblem.type, "https://api.quickarte.ma/problems/default-branch-delete");

  const oldDefault = setup.defaultBranch.id;
  const deleteOldDefaultResponse = await fetch(`${baseUrl}/v1/branches/${oldDefault}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(deleteOldDefaultResponse.status, 204, await deleteOldDefaultResponse.text());

  const tenantBToken = tokenFor(businessBId, userBId, ownerRoleBId);
  const forgedResponse = await apiGet(`/v1/branches/${created.id}`, tenantBToken);
  assert.equal(forgedResponse.status, 404, await forgedResponse.text());
});

async function seedRolesAndPermissions(businessId: string): Promise<void> {
  await adminDb.insert(permissions).values([
    { id: "business.view", description: "View business", category: "business" },
    { id: "business.update", description: "Update business", category: "business" },
    { id: "branch.view", description: "View branches", category: "branch" },
    { id: "branch.create", description: "Create branches", category: "branch" },
    { id: "branch.update", description: "Update branches", category: "branch" },
    { id: "branch.delete", description: "Delete branches", category: "branch" },
  ]).onConflictDoNothing();

  await adminDb.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL app.current_business_id = '${businessId}'`));
    await tx.insert(permissionVersions).values({ businessId, version: 1 }).onConflictDoNothing();

    const [ownerRole] = await tx
      .insert(roles)
      .values({ businessId, name: "Owner", isSystem: true })
      .returning({ id: roles.id });
    const [managerRole] = await tx
      .insert(roles)
      .values({ businessId, name: "Manager", isSystem: true })
      .returning({ id: roles.id });
    const [cashierRole] = await tx
      .insert(roles)
      .values({ businessId, name: "Cashier", isSystem: true })
      .returning({ id: roles.id });

    assert.ok(ownerRole);
    assert.ok(managerRole);
    assert.ok(cashierRole);
    if (businessId === businessAId) {
      ownerRoleAId = ownerRole.id;
    }
    if (businessId === businessBId) {
      ownerRoleBId = ownerRole.id;
    }

    await tx.insert(rolePermissions).values([
      ...["business.view", "business.update", "branch.view", "branch.create", "branch.update", "branch.delete"].map((permissionId) => ({
        roleId: ownerRole.id,
        permissionId,
      })),
      ...["business.view", "business.update", "branch.view", "branch.create", "branch.update", "branch.delete"].map((permissionId) => ({
        roleId: managerRole.id,
        permissionId,
      })),
      { roleId: cashierRole.id, permissionId: "branch.view" },
    ]).onConflictDoNothing();
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
  method: "POST" | "PATCH",
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
