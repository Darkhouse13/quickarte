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
  categories,
  categoryPrintRoutes,
  permissionVersions,
  permissions,
  productVariants,
  products,
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
const allStations = ["bar", "counter", "kitchen"];

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
let categoryAId: string;
let categoryBId: string;
let productAId: string;
let productBId: string;
let variantAId: string;

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
  branchAId = randomUUID();
  branchBId = randomUUID();
  categoryAId = randomUUID();
  categoryBId = randomUUID();
  productAId = randomUUID();
  productBId = randomUUID();
  variantAId = randomUUID();

  await adminDb.insert(users).values([
    { id: userAId, name: "Tax Routing Owner A", email: `tax-route-a-${runId}@example.test`, role: "owner" },
    { id: userBId, name: "Tax Routing Owner B", email: `tax-route-b-${runId}@example.test`, role: "owner" },
  ]);
  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: userAId,
      name: "Tax Routing Tenant A",
      slug: `tax-route-a-${runId}`,
      type: "restaurant",
    },
    {
      id: businessBId,
      ownerId: userBId,
      name: "Tax Routing Tenant B",
      slug: `tax-route-b-${runId}`,
      type: "restaurant",
    },
  ]);
  await adminDb.insert(branches).values([
    { id: branchAId, businessId: businessAId, name: "Medina", slug: `medina-tax-${runId}`, isDefault: true },
    { id: branchBId, businessId: businessBId, name: "Tenant B", slug: `b-tax-${runId}`, isDefault: true },
  ]);
  await seedRolesAndPermissions(businessAId);
  await seedRolesAndPermissions(businessBId);
  await adminDb.insert(categories).values([
    {
      id: categoryAId,
      businessId: businessAId,
      name: "Poissons",
      slug: `poissons-${runId}`,
      localizedNames: { fr: "Poissons" },
      position: 0,
    },
    {
      id: categoryBId,
      businessId: businessBId,
      name: "Tenant B",
      slug: `tenant-b-tax-${runId}`,
      localizedNames: { fr: "Tenant B" },
      position: 0,
    },
  ]);
  await adminDb.insert(products).values([
    {
      id: productAId,
      businessId: businessAId,
      categoryId: categoryAId,
      name: "Dorade",
      price: "120.00",
      localizedNames: { fr: "Dorade" },
      position: 0,
    },
    {
      id: productBId,
      businessId: businessBId,
      categoryId: categoryBId,
      name: "Tenant B fish",
      price: "120.00",
      localizedNames: { fr: "Tenant B fish" },
      position: 0,
    },
  ]);
  await adminDb.insert(productVariants).values({
    id: variantAId,
    productId: productAId,
    name: "Portion",
    priceOverride: "120.00",
    variantKind: "size",
    pricingMode: "fixed",
    position: 0,
    isDefault: true,
  });

  const { AppModule } = await import("../src/app.module");
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
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

test("M3.4 tax precedence resolves product, category, branch default, then service fallback", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);

  let product = findProduct(await effectiveMenu(branchAId, tokenA), productAId);
  assert.equal(product?.effectiveTaxRateId, "ma_tva_10");
  assert.equal(product?.taxSource, "fallback");

  await databaseService.withTenant(businessAId, (tx) =>
    tx.insert(branchTaxSettings).values({
      businessId: businessAId,
      branchId: branchAId,
      defaultTaxRateId: "ma_tva_10",
    }),
  );
  product = findProduct(await effectiveMenu(branchAId, tokenA), productAId);
  assert.equal(product?.effectiveTaxRateId, "ma_tva_10");
  assert.equal(product?.taxSource, "branch_default");

  await databaseService.withTenant(businessAId, (tx) =>
    tx.update(branchTaxSettings).set({
      defaultTaxRateId: "ma_tva_20",
    }).where(eq(branchTaxSettings.branchId, branchAId)),
  );
  product = findProduct(await effectiveMenu(branchAId, tokenA), productAId);
  assert.equal(product?.effectiveTaxRateId, "ma_tva_20");
  assert.equal(product?.taxSource, "branch_default");

  await databaseService.withTenant(businessAId, (tx) =>
    tx.execute(sql`
      INSERT INTO branch_category_tax_overrides (business_id, branch_id, category_id, tax_rate_id)
      VALUES (${businessAId}, ${branchAId}, ${categoryAId}, 'ma_tva_14')
    `),
  );
  product = findProduct(await effectiveMenu(branchAId, tokenA), productAId);
  assert.equal(product?.effectiveTaxRateId, "ma_tva_14");
  assert.equal(product?.taxSource, "category");

  await databaseService.withTenant(businessAId, (tx) =>
    tx.execute(sql`
      INSERT INTO branch_product_tax_overrides (business_id, branch_id, product_id, tax_rate_id)
      VALUES (${businessAId}, ${branchAId}, ${productAId}, 'ma_tva_7')
    `),
  );
  product = findProduct(await effectiveMenu(branchAId, tokenA), productAId);
  assert.equal(product?.effectiveTaxRateId, "ma_tva_7");
  assert.equal(product?.taxSource, "product");

  await databaseService.withTenant(businessAId, (tx) =>
    tx.execute(sql`DELETE FROM branch_product_tax_overrides WHERE business_id = ${businessAId}`),
  );
  product = findProduct(await effectiveMenu(branchAId, tokenA), productAId);
  assert.equal(product?.effectiveTaxRateId, "ma_tva_14");
  assert.equal(product?.taxSource, "category");

  await databaseService.withTenant(businessAId, (tx) =>
    tx.execute(sql`DELETE FROM branch_category_tax_overrides WHERE business_id = ${businessAId}`),
  );
  product = findProduct(await effectiveMenu(branchAId, tokenA), productAId);
  assert.equal(product?.effectiveTaxRateId, "ma_tva_20");
  assert.equal(product?.taxSource, "branch_default");

  await databaseService.withTenant(businessAId, (tx) =>
    tx.delete(branchTaxSettings).where(eq(branchTaxSettings.branchId, branchAId)),
  );
  product = findProduct(await effectiveMenu(branchAId, tokenA), productAId);
  assert.equal(product?.effectiveTaxRateId, "ma_tva_10");
  assert.equal(product?.taxSource, "fallback");
});

test("M3.4 routing precedence resolves product branch, category branch, legacy category, then all stations", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);

  assert.deepEqual(findProduct(await effectiveMenu(branchAId, tokenA), productAId)?.printStations.sort(), allStations);

  await adminDb.insert(categoryPrintRoutes).values({
    businessId: businessAId,
    categoryId: categoryAId,
    station: "kitchen",
  });
  assert.deepEqual(findProduct(await effectiveMenu(branchAId, tokenA), productAId)?.printStations, ["kitchen"]);

  await databaseService.withTenant(businessAId, (tx) =>
    tx.execute(sql`
      INSERT INTO branch_category_print_routes (business_id, branch_id, category_id, station)
      VALUES (${businessAId}, ${branchAId}, ${categoryAId}, 'bar')
    `),
  );
  assert.deepEqual(findProduct(await effectiveMenu(branchAId, tokenA), productAId)?.printStations, ["bar"]);

  await databaseService.withTenant(businessAId, (tx) =>
    tx.execute(sql`
      INSERT INTO branch_product_print_routes (business_id, branch_id, product_id, station)
      VALUES (${businessAId}, ${branchAId}, ${productAId}, 'counter'), (${businessAId}, ${branchAId}, ${productAId}, 'kitchen')
    `),
  );
  assert.deepEqual(findProduct(await effectiveMenu(branchAId, tokenA), productAId)?.printStations.sort(), ["counter", "kitchen"]);
});

test("M3.4 override endpoints atomically replace tax overrides and print routes", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);

  const taxResponse = await apiJson(
    `/v1/branches/${branchAId}/menu-tax-overrides`,
    "PUT",
    tokenA,
    {
      categoryTaxOverrides: [{ categoryId: categoryAId, taxRateId: "ma_tva_14" }],
      productTaxOverrides: [{ productId: productAId, taxRateId: "ma_tva_20" }],
    },
  );
  assert.equal(taxResponse.status, 200, await taxResponse.text());

  const routeResponse = await apiJson(
    `/v1/branches/${branchAId}/menu-print-routes`,
    "PUT",
    tokenA,
    {
      categoryPrintRoutes: [{ categoryId: categoryAId, stations: ["bar"] }],
      productPrintRoutes: [{ productId: productAId, stations: ["counter", "kitchen"] }],
    },
  );
  assert.equal(routeResponse.status, 200, await routeResponse.text());

  const overrides = await apiGet(`/v1/branches/${branchAId}/menu-overrides`, tokenA);
  const body = await overrides.json();
  assert.equal(overrides.status, 200, JSON.stringify(body));
  assert.deepEqual(body.categoryTaxOverrides, [{ categoryId: categoryAId, taxRateId: "ma_tva_14" }]);
  assert.deepEqual(body.productTaxOverrides, [{ productId: productAId, taxRateId: "ma_tva_20" }]);
  assert.deepEqual(body.categoryPrintRoutes, [{ categoryId: categoryAId, stations: ["bar"] }]);
  assert.deepEqual(body.productPrintRoutes, [{ productId: productAId, stations: ["counter", "kitchen"] }]);
});

test("M3.4 RLS isolates tax and print route override tables", async (t) => {
  await databaseService.withTenant(businessAId, async (tx) => {
    await tx.execute(sql`
      INSERT INTO branch_category_tax_overrides (business_id, branch_id, category_id, tax_rate_id)
      VALUES (${businessAId}, ${branchAId}, ${categoryAId}, 'ma_tva_14')
      ON CONFLICT DO NOTHING
    `);
    await tx.execute(sql`
      INSERT INTO branch_product_tax_overrides (business_id, branch_id, product_id, tax_rate_id)
      VALUES (${businessAId}, ${branchAId}, ${productAId}, 'ma_tva_20')
      ON CONFLICT DO NOTHING
    `);
    await tx.execute(sql`
      INSERT INTO branch_category_print_routes (business_id, branch_id, category_id, station)
      VALUES (${businessAId}, ${branchAId}, ${categoryAId}, 'bar')
      ON CONFLICT DO NOTHING
    `);
    await tx.execute(sql`
      INSERT INTO branch_product_print_routes (business_id, branch_id, product_id, station)
      VALUES (${businessAId}, ${branchAId}, ${productAId}, 'counter')
      ON CONFLICT DO NOTHING
    `);
  });

  await t.test("tenant A reads its own override rows", async () => {
    assert.ok(await rowCountWithTenant(businessAId, "branch_category_tax_overrides") > 0);
    assert.ok(await rowCountWithTenant(businessAId, "branch_product_tax_overrides") > 0);
    assert.ok(await rowCountWithTenant(businessAId, "branch_category_print_routes") > 0);
    assert.ok(await rowCountWithTenant(businessAId, "branch_product_print_routes") > 0);
  });

  await t.test("tenant B forged predicates cannot read tenant A override rows", async () => {
    assert.equal(await forgedRowCount(businessBId, "branch_category_tax_overrides", businessAId), 0);
    assert.equal(await forgedRowCount(businessBId, "branch_product_tax_overrides", businessAId), 0);
    assert.equal(await forgedRowCount(businessBId, "branch_category_print_routes", businessAId), 0);
    assert.equal(await forgedRowCount(businessBId, "branch_product_print_routes", businessAId), 0);
  });

  await t.test("direct app-role query without tenant context reads zero rows", async () => {
    assert.equal((await appDb.execute(sql`SELECT * FROM branch_category_tax_overrides`)).rowCount, 0);
    assert.equal((await appDb.execute(sql`SELECT * FROM branch_product_tax_overrides`)).rowCount, 0);
    assert.equal((await appDb.execute(sql`SELECT * FROM branch_category_print_routes`)).rowCount, 0);
    assert.equal((await appDb.execute(sql`SELECT * FROM branch_product_print_routes`)).rowCount, 0);
  });

  await t.test("tenant A cannot write tenant B override rows", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.execute(sql`
          INSERT INTO branch_category_tax_overrides (business_id, branch_id, category_id, tax_rate_id)
          VALUES (${businessBId}, ${branchBId}, ${categoryBId}, 'ma_tva_14')
        `),
      ),
      (error) =>
        /row-level security policy|violates row-level security/i.test(
          `${String(error)} ${String((error as { cause?: unknown }).cause)}`,
        ),
    );
  });
});

async function rowCountWithTenant(businessId: string, tableName: string): Promise<number> {
  return databaseService.withTenant(businessId, async (tx) => {
    const result = await tx.execute(sql.raw(`SELECT count(*)::int AS count FROM ${tableName}`));
    return Number(result.rows[0]?.count ?? 0);
  });
}

async function forgedRowCount(contextBusinessId: string, tableName: string, forgedBusinessId: string): Promise<number> {
  return databaseService.withTenant(contextBusinessId, async (tx) => {
    const result = await tx.execute(
      sql.raw(`SELECT count(*)::int AS count FROM ${tableName} WHERE business_id = '${forgedBusinessId}'`),
    );
    return Number(result.rows[0]?.count ?? 0);
  });
}

async function seedRolesAndPermissions(businessId: string): Promise<void> {
  const permissionIds = ["menu.view", "menu.manage", "printer.view", "printer.manage"];

  await adminDb
    .insert(permissions)
    .values(
      permissionIds.map((id) => ({
        id,
        description: id,
        category: id.startsWith("printer.") ? "printer" : "menu",
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
    if (businessId === businessAId) ownerRoleAId = ownerRole.id;

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

async function effectiveMenu(branchId: string, token: string) {
  const response = await apiGet(`/v1/branches/${branchId}/menu/effective?channel=pos`, token);
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body as {
    categories: Array<{
      products: Array<{
        id: string;
        effectiveTaxRateId: string;
        printStations: string[];
      }>;
      children: Array<{
        products: Array<{
          id: string;
          effectiveTaxRateId: string;
          printStations: string[];
        }>;
      }>;
    }>;
  };
}

function findProduct(
  menu: Awaited<ReturnType<typeof effectiveMenu>>,
  productId: string,
) {
  return menu.categories
    .flatMap((category) => [category, ...category.children])
    .flatMap((category) => category.products)
    .find((product) => product.id === productId);
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
