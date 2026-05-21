import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  branchCategoryOverrides,
  branchOptionValueOverrides,
  branchProductOverrides,
  branchProductPriceOverrides,
  branches,
  businesses,
  categories,
  optionValues,
  permissionVersions,
  permissions,
  productOptions,
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
let branchA2Id: string;
let branchBId: string;
let userAId: string;
let userBId: string;
let ownerRoleAId: string;
let ownerRoleBId: string;
let categoryAId: string;
let categoryBId: string;
let productAId: string;
let inheritProductId: string;
let productBId: string;
let variantAId: string;
let inheritVariantId: string;
let optionValueAId: string;

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
  branchA2Id = randomUUID();
  branchBId = randomUUID();
  categoryAId = randomUUID();
  categoryBId = randomUUID();
  productAId = randomUUID();
  inheritProductId = randomUUID();
  productBId = randomUUID();
  variantAId = randomUUID();
  inheritVariantId = randomUUID();
  optionValueAId = randomUUID();

  await adminDb.insert(users).values([
    { id: userAId, name: "Override Owner A", email: `override-a-${runId}@example.test`, role: "owner" },
    { id: userBId, name: "Override Owner B", email: `override-b-${runId}@example.test`, role: "owner" },
  ]);
  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: userAId,
      name: "Override Tenant A",
      slug: `override-a-${runId}`,
      type: "restaurant",
    },
    {
      id: businessBId,
      ownerId: userBId,
      name: "Override Tenant B",
      slug: `override-b-${runId}`,
      type: "restaurant",
    },
  ]);
  await adminDb.insert(branches).values([
    { id: branchAId, businessId: businessAId, name: "Medina", slug: `medina-${runId}`, isDefault: true },
    { id: branchA2Id, businessId: businessAId, name: "Gueliz", slug: `gueliz-${runId}`, isDefault: false },
    { id: branchBId, businessId: businessBId, name: "Tenant B", slug: `b-${runId}`, isDefault: true },
  ]);
  await seedRolesAndPermissions(businessAId);
  await seedRolesAndPermissions(businessBId);

  await adminDb.insert(categories).values([
    {
      id: categoryAId,
      businessId: businessAId,
      name: "Grillades",
      slug: `grillades-${runId}`,
      localizedNames: { fr: "Grillades" },
      position: 0,
    },
    {
      id: categoryBId,
      businessId: businessBId,
      name: "Tenant B Secrets",
      slug: `secrets-${runId}`,
      localizedNames: { fr: "Secrets" },
      position: 0,
    },
  ]);
  await adminDb.insert(products).values([
    {
      id: productAId,
      businessId: businessAId,
      categoryId: categoryAId,
      name: "Poulet entier",
      price: "95.00",
      localizedNames: { fr: "Poulet entier" },
      availableQr: true,
      position: 0,
    },
    {
      id: inheritProductId,
      businessId: businessAId,
      categoryId: categoryAId,
      name: "Brochette kefta",
      price: "60.00",
      localizedNames: { fr: "Brochette kefta" },
      availableQr: true,
      position: 1,
    },
    {
      id: productBId,
      businessId: businessBId,
      categoryId: categoryBId,
      name: "Tenant B Pastilla",
      price: "120.00",
      localizedNames: { fr: "Pastilla" },
      position: 0,
    },
  ]);
  await adminDb.insert(productVariants).values([
    {
      id: variantAId,
      productId: productAId,
      name: "Entier",
      priceOverride: "95.00",
      variantKind: "size",
      pricingMode: "fixed",
      position: 0,
      isDefault: true,
    },
    {
      id: inheritVariantId,
      productId: inheritProductId,
      name: "Portion",
      priceOverride: "60.00",
      variantKind: "size",
      pricingMode: "fixed",
      position: 0,
      isDefault: true,
    },
  ]);
  const [option] = await adminDb
    .insert(productOptions)
    .values({
      productId: productAId,
      name: "Sauce",
      localizedNames: { fr: "Sauce" },
      type: "single_select",
      position: 0,
    })
    .returning({ id: productOptions.id });
  assert.ok(option);
  await adminDb.insert(optionValues).values({
    id: optionValueAId,
    optionId: option.id,
    name: "Harissa",
    localizedNames: { fr: "Harissa" },
    priceAddition: "0.00",
    position: 0,
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

test("M3.3 effective menu resolves branch-specific prices, 86 state, channels, and inheritance", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);

  const priceResponse = await apiJson(
    `/v1/branches/${branchAId}/products/${productAId}/prices`,
    "PUT",
    tokenA,
    { prices: [{ variantId: variantAId, price: "70.00" }] },
  );
  assert.equal(priceResponse.status, 200, await priceResponse.text());

  const branchAMenu = await effectiveMenu(branchAId, "pos", tokenA);
  const branchA2Menu = await effectiveMenu(branchA2Id, "pos", tokenA);
  assert.equal(findVariant(branchAMenu, productAId, variantAId)?.price, "70.00");
  assert.equal(findVariant(branchAMenu, productAId, variantAId)?.priceSource, "overridden");
  assert.equal(findVariant(branchA2Menu, productAId, variantAId)?.price, "95.00");
  assert.equal(findVariant(branchA2Menu, productAId, variantAId)?.priceSource, "inherited");
  assert.equal(findProduct(branchAMenu, inheritProductId)?.variants[0]?.price, "60.00");
  assert.equal(findProduct(branchA2Menu, inheritProductId)?.variants[0]?.price, "60.00");

  const eightySixResponse = await apiJson(
    `/v1/branches/${branchAId}/products/${productAId}/availability`,
    "PATCH",
    tokenA,
    { is86d: true, eightySixedReason: "Rupture service" },
  );
  assert.equal(eightySixResponse.status, 200, await eightySixResponse.text());
  assert.equal(findProduct(await effectiveMenu(branchAId, "pos", tokenA), productAId), undefined);
  assert.ok(findProduct(await effectiveMenu(branchA2Id, "pos", tokenA), productAId));

  const channelResponse = await apiJson(
    `/v1/branches/${branchAId}/products/${productAId}/availability`,
    "PATCH",
    tokenA,
    { is86d: false, channels: { qr: false } },
  );
  assert.equal(channelResponse.status, 200, await channelResponse.text());
  assert.equal(findProduct(await effectiveMenu(branchAId, "qr", tokenA), productAId), undefined);
  assert.ok(findProduct(await effectiveMenu(branchAId, "pos", tokenA), productAId));
  assert.ok(findProduct(await effectiveMenu(branchAId, "dine_in", tokenA), productAId));
});

test("M3.3 RLS isolates branch override tables", async (t) => {
  await databaseService.withTenant(businessAId, async (tx) => {
    await tx.insert(branchCategoryOverrides).values({
      businessId: businessAId,
      branchId: branchA2Id,
      categoryId: categoryAId,
      visible: true,
      position: 5,
    });
    await tx.insert(branchProductOverrides).values({
      businessId: businessAId,
      branchId: branchA2Id,
      productId: productAId,
      available: true,
      is86d: false,
    });
    await tx.insert(branchProductPriceOverrides).values({
      businessId: businessAId,
      branchId: branchA2Id,
      productId: productAId,
      variantId: variantAId,
      price: "88.00",
    });
    await tx.insert(branchOptionValueOverrides).values({
      businessId: businessAId,
      branchId: branchA2Id,
      optionValueId: optionValueAId,
      available: true,
      priceAddition: "2.00",
    });
  });

  await t.test("tenant A reads its own override rows", async () => {
    assert.ok((await databaseService.withTenant(businessAId, (tx) => tx.select().from(branchCategoryOverrides))).length > 0);
    assert.ok((await databaseService.withTenant(businessAId, (tx) => tx.select().from(branchProductOverrides))).length > 0);
    assert.ok((await databaseService.withTenant(businessAId, (tx) => tx.select().from(branchProductPriceOverrides))).length > 0);
    assert.ok((await databaseService.withTenant(businessAId, (tx) => tx.select().from(branchOptionValueOverrides))).length > 0);
  });

  await t.test("tenant B forged predicates cannot read tenant A override rows", async () => {
    assert.equal((await databaseService.withTenant(businessBId, (tx) =>
      tx.select().from(branchCategoryOverrides).where(eq(branchCategoryOverrides.businessId, businessAId)),
    )).length, 0);
    assert.equal((await databaseService.withTenant(businessBId, (tx) =>
      tx.select().from(branchProductOverrides).where(eq(branchProductOverrides.businessId, businessAId)),
    )).length, 0);
    assert.equal((await databaseService.withTenant(businessBId, (tx) =>
      tx.select().from(branchProductPriceOverrides).where(eq(branchProductPriceOverrides.businessId, businessAId)),
    )).length, 0);
    assert.equal((await databaseService.withTenant(businessBId, (tx) =>
      tx.select().from(branchOptionValueOverrides).where(eq(branchOptionValueOverrides.businessId, businessAId)),
    )).length, 0);
  });

  await t.test("direct app-role query without tenant context reads zero rows", async () => {
    assert.equal((await appDb.select().from(branchCategoryOverrides)).length, 0);
    assert.equal((await appDb.select().from(branchProductOverrides)).length, 0);
    assert.equal((await appDb.select().from(branchProductPriceOverrides)).length, 0);
    assert.equal((await appDb.select().from(branchOptionValueOverrides)).length, 0);
  });

  await t.test("tenant A cannot write tenant B override rows", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(branchCategoryOverrides).values({
          businessId: businessBId,
          branchId: branchBId,
          categoryId: categoryBId,
          visible: false,
        }),
      ),
      (error) =>
        /row-level security policy|violates row-level security/i.test(
          `${String(error)} ${String((error as { cause?: unknown }).cause)}`,
        ),
    );
  });
});

test("branch effective menu API explicitly rejects cross-tenant shared catalog access", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);
  const tokenB = tokenFor(businessBId, userBId, ownerRoleBId);

  const forgedBranchRead = await apiGet(`/v1/branches/${branchBId}/menu/effective?channel=pos`, tokenA);
  assert.equal(forgedBranchRead.status, 404, await forgedBranchRead.text());

  const forgedPriceWrite = await apiJson(
    `/v1/branches/${branchAId}/products/${productBId}/prices`,
    "PUT",
    tokenA,
    { prices: [{ variantId: variantAId, price: "1.00" }] },
  );
  assert.equal(forgedPriceWrite.status, 404, await forgedPriceWrite.text());

  const tenantBRead = await effectiveMenu(branchBId, "pos", tokenB);
  assert.ok(findProduct(tenantBRead, productBId));
  assert.equal(findProduct(tenantBRead, productAId), undefined);
});

async function seedRolesAndPermissions(businessId: string): Promise<void> {
  const permissionIds = ["menu.view", "menu.manage", "order.view", "order.update"];

  await adminDb
    .insert(permissions)
    .values(
      permissionIds.map((id) => ({
        id,
        description: id,
        category: id.startsWith("order.") ? "order" : "menu",
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
    if (businessId === businessBId) ownerRoleBId = ownerRole.id;

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

async function effectiveMenu(branchId: string, channel: string, token: string) {
  const response = await apiGet(`/v1/branches/${branchId}/menu/effective?channel=${channel}`, token);
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body as {
    categories: Array<{
      products: Array<{
        id: string;
        variants: Array<{ id: string | null; price: string | null; priceSource: string }>;
      }>;
      children: Array<{
        products: Array<{
          id: string;
          variants: Array<{ id: string | null; price: string | null; priceSource: string }>;
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

function findVariant(
  menu: Awaited<ReturnType<typeof effectiveMenu>>,
  productId: string,
  variantId: string,
) {
  return findProduct(menu, productId)?.variants.find((variant) => variant.id === variantId);
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
