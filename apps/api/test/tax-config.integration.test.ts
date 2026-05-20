import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  branchTaxSettings,
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
    { id: userAId, name: "Tax Owner A", email: `tax-a-${runId}@example.test`, role: "owner" },
    { id: userBId, name: "Tax Owner B", email: `tax-b-${runId}@example.test`, role: "owner" },
  ]);
  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: userAId,
      name: "Tax Tenant A",
      slug: `tax-a-${runId}`,
      type: "restaurant",
    },
    {
      id: businessBId,
      ownerId: userBId,
      name: "Tax Tenant B",
      slug: `tax-b-${runId}`,
      type: "cafe",
    },
  ]);

  const [branchA] = await adminDb
    .insert(branches)
    .values({
      businessId: businessAId,
      name: "Tax Branch A",
      slug: `tax-main-a-${runId}`,
      isDefault: true,
    })
    .returning({ id: branches.id });
  const [branchB] = await adminDb
    .insert(branches)
    .values({
      businessId: businessBId,
      name: "Tax Branch B",
      slug: `tax-main-b-${runId}`,
      isDefault: true,
    })
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

test("M2.3 RLS isolates branch tax settings", async (t) => {
  await databaseService.withTenant(businessAId, async (tx) => {
    await tx.insert(branchTaxSettings).values({
      businessId: businessAId,
      branchId: branchAId,
      defaultTaxRateId: "ma_tva_10",
      taxApplicationLevel: "category",
      priceDisplayMode: "ttc",
      serviceChargeEnabled: true,
      serviceChargeRate: "7.50",
      serviceChargeLabel: "Service",
    });
  });

  await t.test("tenant A can read only its own tax settings", async () => {
    const rows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(branchTaxSettings),
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.businessId, businessAId);
  });

  await t.test("tenant B forged predicates cannot read tenant A settings", async () => {
    const rows = await databaseService.withTenant(businessBId, (tx) =>
      tx
        .select()
        .from(branchTaxSettings)
        .where(eq(branchTaxSettings.businessId, businessAId)),
    );
    assert.equal(rows.length, 0);
  });

  await t.test("direct app-role query without tenant context reads zero rows", async () => {
    assert.equal((await appDb.select().from(branchTaxSettings)).length, 0);
  });

  await t.test("tenant A cannot insert tax settings for tenant B", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(branchTaxSettings).values({
          businessId: businessBId,
          branchId: branchBId,
          defaultTaxRateId: "ma_tva_20",
          taxApplicationLevel: "item",
          priceDisplayMode: "ht_plus_tva",
          serviceChargeEnabled: false,
        }),
      ),
      (error) =>
        /row-level security policy|violates row-level security/i.test(
          `${String(error)} ${String((error as { cause?: unknown }).cause)}`,
        ),
    );
  });
});

test("tax-rates endpoint returns seeded Moroccan TVA rates", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const response = await apiGet("/v1/tax-rates", token);
  const body = (await response.json()) as {
    rates: Array<{ id: string; rate: number; label: string }>;
  };
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.ok(body.rates.some((rate) => rate.id === "ma_tva_10" && rate.rate === 10));
  assert.ok(body.rates.some((rate) => rate.id === "ma_tva_20" && rate.label === "TVA 20%"));
});

test("tax-config endpoint presents defaults before a row exists", async () => {
  const token = tokenFor(businessBId, userBId, ownerRoleBId);
  const response = await apiGet(`/v1/branches/${branchBId}/tax-config`, token);
  const body = (await response.json()) as {
    defaultTaxRateId: string;
    taxApplicationLevel: string;
    priceDisplayMode: string;
    serviceChargeEnabled: boolean;
    serviceChargeRate: number | null;
    isDefaultPresentation: boolean;
  };
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.defaultTaxRateId, "ma_tva_10");
  assert.equal(body.taxApplicationLevel, "category");
  assert.equal(body.priceDisplayMode, "ttc");
  assert.equal(body.serviceChargeEnabled, false);
  assert.equal(body.serviceChargeRate, null);
  assert.equal(body.isDefaultPresentation, true);
});

test("tax-config endpoint upserts branch tax settings", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);

  const createResponse = await apiJson(`/v1/branches/${branchAId}/tax-config`, "PUT", token, {
    defaultTaxRateId: "ma_tva_14",
    taxApplicationLevel: "item",
    priceDisplayMode: "ht_plus_tva",
    serviceChargeEnabled: true,
    serviceChargeRate: 12.5,
    serviceChargeLabel: "Frais de service",
  });
  const created = (await createResponse.json()) as {
    defaultTaxRateId: string;
    taxApplicationLevel: string;
    priceDisplayMode: string;
    serviceChargeEnabled: boolean;
    serviceChargeRate: number | null;
    serviceChargeLabel: string | null;
    isDefaultPresentation: boolean;
  };
  assert.equal(createResponse.status, 200, JSON.stringify(created));
  assert.equal(created.defaultTaxRateId, "ma_tva_14");
  assert.equal(created.serviceChargeRate, 12.5);
  assert.equal(created.isDefaultPresentation, false);

  const updateResponse = await apiJson(`/v1/branches/${branchAId}/tax-config`, "PUT", token, {
    defaultTaxRateId: "ma_tva_10",
    taxApplicationLevel: "category",
    priceDisplayMode: "ttc",
    serviceChargeEnabled: false,
    serviceChargeRate: null,
    serviceChargeLabel: null,
  });
  const updated = (await updateResponse.json()) as {
    defaultTaxRateId: string;
    serviceChargeEnabled: boolean;
    serviceChargeRate: number | null;
    serviceChargeLabel: string | null;
  };
  assert.equal(updateResponse.status, 200, JSON.stringify(updated));
  assert.equal(updated.defaultTaxRateId, "ma_tva_10");
  assert.equal(updated.serviceChargeEnabled, false);
  assert.equal(updated.serviceChargeRate, null);
  assert.equal(updated.serviceChargeLabel, null);
});

test("tax-config endpoint validates service charge constraints and tenant branch ownership", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);

  const missingRateResponse = await apiJson(`/v1/branches/${branchAId}/tax-config`, "PUT", token, {
    defaultTaxRateId: "ma_tva_10",
    taxApplicationLevel: "category",
    priceDisplayMode: "ttc",
    serviceChargeEnabled: true,
    serviceChargeLabel: "Service",
  });
  assert.equal(missingRateResponse.status, 400, await missingRateResponse.text());

  const outOfBoundsResponse = await apiJson(`/v1/branches/${branchAId}/tax-config`, "PUT", token, {
    defaultTaxRateId: "ma_tva_10",
    taxApplicationLevel: "category",
    priceDisplayMode: "ttc",
    serviceChargeEnabled: true,
    serviceChargeRate: 125,
  });
  assert.equal(outOfBoundsResponse.status, 400, await outOfBoundsResponse.text());

  const unknownRateResponse = await apiJson(`/v1/branches/${branchAId}/tax-config`, "PUT", token, {
    defaultTaxRateId: "ma_tva_99",
    taxApplicationLevel: "category",
    priceDisplayMode: "ttc",
    serviceChargeEnabled: false,
  });
  assert.equal(unknownRateResponse.status, 400, await unknownRateResponse.text());

  const tenantBToken = tokenFor(businessBId, userBId, ownerRoleBId);
  const forgedResponse = await apiGet(`/v1/branches/${branchAId}/tax-config`, tenantBToken);
  assert.equal(forgedResponse.status, 404, await forgedResponse.text());
});

async function seedRolesAndPermissions(businessId: string): Promise<void> {
  const permissionIds = ["tax.view", "tax.update"];

  await adminDb
    .insert(permissions)
    .values(
      permissionIds.map((id) => ({
        id,
        description: id,
        category: "tax",
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
