import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  branches,
  businesses,
  categories,
  dietaryTags,
  permissionVersions,
  permissions,
  productAvailabilityWindows,
  products,
  productTags,
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
import { EffectiveMenuResolver } from "../src/menu-catalog/effective-menu.resolver";

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
let effectiveMenuResolver: EffectiveMenuResolver;
let businessAId: string;
let businessBId: string;
let branchAId: string;
let branchBId: string;
let branchCId: string;
let userAId: string;
let userBId: string;
let ownerRoleAId: string;
let categoryAId: string;
let categoryBId: string;
let productAId: string;
let productBId: string;

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
  branchCId = randomUUID();
  categoryAId = randomUUID();
  categoryBId = randomUUID();
  productAId = randomUUID();
  productBId = randomUUID();

  await adminDb.insert(users).values([
    { id: userAId, name: "Tags Owner A", email: `tags-a-${runId}@example.test`, role: "owner" },
    { id: userBId, name: "Tags Owner B", email: `tags-b-${runId}@example.test`, role: "owner" },
  ]);
  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: userAId,
      name: "Tags Tenant A",
      slug: `tags-a-${runId}`,
      type: "restaurant",
      timezone: "Africa/Casablanca",
    },
    {
      id: businessBId,
      ownerId: userBId,
      name: "Tags Tenant B",
      slug: `tags-b-${runId}`,
      type: "restaurant",
      timezone: "Africa/Casablanca",
    },
  ]);
  await adminDb.insert(branches).values([
    {
      id: branchAId,
      businessId: businessAId,
      name: "Casablanca",
      slug: `casa-tags-${runId}`,
      isDefault: true,
      timezone: "Africa/Casablanca",
    },
    {
      id: branchCId,
      businessId: businessAId,
      name: "New York Demo",
      slug: `ny-tags-${runId}`,
      timezone: "America/New_York",
    },
    {
      id: branchBId,
      businessId: businessBId,
      name: "Tenant B",
      slug: `b-tags-${runId}`,
      isDefault: true,
      timezone: "Africa/Casablanca",
    },
  ]);
  await seedRolesAndPermissions(businessAId);
  await seedRolesAndPermissions(businessBId);

  await adminDb.insert(categories).values([
    {
      id: categoryAId,
      businessId: businessAId,
      name: "Tajines",
      slug: `tajines-${runId}`,
      localizedNames: { fr: "Tajines" },
      position: 0,
    },
    {
      id: categoryBId,
      businessId: businessBId,
      name: "Tenant B",
      slug: `tenant-b-tags-${runId}`,
      localizedNames: { fr: "Tenant B" },
      position: 0,
    },
  ]);
  await adminDb.insert(products).values([
    {
      id: productAId,
      businessId: businessAId,
      categoryId: categoryAId,
      name: "Tajine legumes",
      price: "80.00",
      localizedNames: { fr: "Tajine légumes" },
      spiceLevel: 2,
      position: 0,
    },
    {
      id: productBId,
      businessId: businessBId,
      categoryId: categoryBId,
      name: "Tenant B secret",
      price: "90.00",
      localizedNames: { fr: "Tenant B secret" },
      position: 0,
    },
  ]);

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
  effectiveMenuResolver = app.get(EffectiveMenuResolver);

  const address = app.getHttpServer().address();
  assert.equal(typeof address, "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await app?.close();
  await appPool?.end();
  await adminPool?.end();
});

test("M3.5a tags and spice level surface on the effective product", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);
  const tagResponse = await apiGet("/v1/menu/tags", tokenA);
  const tagBody = (await tagResponse.json()) as {
    tags: Array<{ id: string; code: string; kind: string; localizedLabels: Record<string, string> }>;
  };
  assert.equal(tagResponse.status, 200, JSON.stringify(tagBody));
  const vegetarian = tagBody.tags.find((tag) => tag.code === "vegetarian");
  assert.ok(vegetarian);

  const dairyResponse = await apiJson("/v1/menu/tags", "POST", tokenA, {
    kind: "allergen",
    code: `contains_dairy_${randomUUID().slice(0, 8)}`,
    localizedLabels: { fr: "Contient lait", ar: "يحتوي على الحليب" },
    position: 50,
  });
  const dairyBody = (await dairyResponse.json()) as { tag: { id: string; code: string } };
  assert.equal(dairyResponse.status, 201, JSON.stringify(dairyBody));

  const replaceResponse = await apiJson(
    `/v1/menu/products/${productAId}/tags`,
    "PUT",
    tokenA,
    { tagIds: [vegetarian.id, dairyBody.tag.id] },
  );
  assert.equal(replaceResponse.status, 200, await replaceResponse.text());

  const menu = await effectiveMenuResolver.getEffectiveMenu(
    businessAId,
    branchAId,
    "pos",
    new Date("2026-05-21T12:00:00Z"),
  );
  const product = findProduct(menu, productAId);
  assert.equal(product?.spiceLevel, 2);
  assert.deepEqual(
    product?.tags.map((tag) => [tag.code, tag.kind, tag.localizedLabels.fr]).sort(),
    [
      [dairyBody.tag.code, "allergen", "Contient lait"],
      ["vegetarian", "dietary", "Végétarien"],
    ].sort(),
  );
});

test("M3.5a system tags cannot be edited or deleted and remain attachable", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);
  const tagResponse = await apiGet("/v1/menu/tags", tokenA);
  const tagBody = (await tagResponse.json()) as {
    tags: Array<{ id: string; code: string; localizedLabels: Record<string, string>; isSystem: boolean }>;
  };
  assert.equal(tagResponse.status, 200, JSON.stringify(tagBody));
  const vegetarian = tagBody.tags.find((tag) => tag.code === "vegetarian");
  assert.ok(vegetarian);
  assert.equal(vegetarian.isSystem, true);

  const patchResponse = await apiJson(
    `/v1/menu/tags/${vegetarian.id}`,
    "PATCH",
    tokenA,
    { localizedLabels: { fr: "Ne pas modifier" } },
  );
  const patchBody = await patchResponse.text();
  assert.equal(patchResponse.status, 400, patchBody);
  assert.match(patchBody, /system-tag-locked/);

  const deleteResponse = await apiDelete(`/v1/menu/tags/${vegetarian.id}`, tokenA);
  const deleteBody = await deleteResponse.text();
  assert.equal(deleteResponse.status, 400, deleteBody);
  assert.match(deleteBody, /system-tag-locked/);

  const afterResponse = await apiGet("/v1/menu/tags", tokenA);
  const afterBody = (await afterResponse.json()) as {
    tags: Array<{ id: string; code: string; localizedLabels: Record<string, string> }>;
  };
  const stillVegetarian = afterBody.tags.find((tag) => tag.id === vegetarian.id);
  assert.ok(stillVegetarian);
  assert.equal(stillVegetarian.localizedLabels.fr, vegetarian.localizedLabels.fr);

  const attachResponse = await apiJson(
    `/v1/menu/products/${productAId}/tags`,
    "PUT",
    tokenA,
    { tagIds: [vegetarian.id] },
  );
  const attachBody = (await attachResponse.json()) as {
    tags: Array<{ id: string; code: string }>;
  };
  assert.equal(attachResponse.status, 200, JSON.stringify(attachBody));
  assert.deepEqual(attachBody.tags.map((tag) => tag.code), ["vegetarian"]);
});

test("M3.5a availability windows evaluate deterministically in the branch timezone", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);

  const noWindowMenu = await effectiveMenuResolver.getEffectiveMenu(
    businessAId,
    branchAId,
    "pos",
    new Date("2026-05-22T12:00:00Z"),
  );
  assert.equal(findProduct(noWindowMenu, productAId)?.availableNow, true);

  const replaceResponse = await apiJson(
    `/v1/menu/products/${productAId}/availability-windows`,
    "PUT",
    tokenA,
    {
      windows: [
        { dayOfWeek: 5, startMinute: 12 * 60, endMinute: 14 * 60 },
      ],
    },
  );
  assert.equal(replaceResponse.status, 200, await replaceResponse.text());

  const fridayLunch = await effectiveMenuResolver.getEffectiveMenu(
    businessAId,
    branchAId,
    "pos",
    new Date("2026-05-22T12:30:00Z"),
  );
  assert.equal(findProduct(fridayLunch, productAId)?.availableNow, true);

  const fridayMorning = await effectiveMenuResolver.getEffectiveMenu(
    businessAId,
    branchAId,
    "pos",
    new Date("2026-05-22T09:00:00Z"),
  );
  assert.equal(findProduct(fridayMorning, productAId)?.availableNow, false);
  const windows = findProduct(fridayMorning, productAId)?.availabilityWindows ?? [];
  assert.equal(windows.length, 1);
  assert.match(windows[0]!.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(
    windows.map(({ dayOfWeek, startMinute, endMinute }) => ({ dayOfWeek, startMinute, endMinute })),
    [{ dayOfWeek: 5, startMinute: 720, endMinute: 840 }],
  );
});

test("M3.5a cross-midnight windows cover both sides of midnight", async () => {
  await databaseService.withTenant(businessAId, async (tx) => {
    await tx.delete(productAvailabilityWindows).where(eq(productAvailabilityWindows.productId, productAId));
    await tx.insert(productAvailabilityWindows).values({
      businessId: businessAId,
      productId: productAId,
      dayOfWeek: 5,
      startMinute: 22 * 60,
      endMinute: 2 * 60,
    });
  });

  const at23 = await effectiveMenuResolver.getEffectiveMenu(
    businessAId,
    branchAId,
    "pos",
    new Date("2026-05-22T22:30:00Z"),
  );
  assert.equal(findProduct(at23, productAId)?.availableNow, true);

  const at01 = await effectiveMenuResolver.getEffectiveMenu(
    businessAId,
    branchAId,
    "pos",
    new Date("2026-05-23T00:30:00Z"),
  );
  assert.equal(findProduct(at01, productAId)?.availableNow, true);

  const atNoon = await effectiveMenuResolver.getEffectiveMenu(
    businessAId,
    branchAId,
    "pos",
    new Date("2026-05-22T12:00:00Z"),
  );
  assert.equal(findProduct(atNoon, productAId)?.availableNow, false);
});

test("M3.5a branch timezone changes availableNow at the same instant", async () => {
  await databaseService.withTenant(businessAId, async (tx) => {
    await tx.delete(productAvailabilityWindows).where(eq(productAvailabilityWindows.productId, productAId));
    await tx.insert(productAvailabilityWindows).values({
      businessId: businessAId,
      productId: productAId,
      dayOfWeek: 5,
      startMinute: 14 * 60,
      endMinute: 15 * 60,
    });
  });

  const sameInstant = new Date("2026-05-22T13:30:00Z");
  const casaMenu = await effectiveMenuResolver.getEffectiveMenu(businessAId, branchAId, "pos", sameInstant);
  const newYorkMenu = await effectiveMenuResolver.getEffectiveMenu(businessAId, branchCId, "pos", sameInstant);

  assert.equal(findProduct(casaMenu, productAId)?.availableNow, true);
  assert.equal(findProduct(newYorkMenu, productAId)?.availableNow, false);
});

test("M3.5a RLS isolates dietary tags, product tags, and product availability windows", async (t) => {
  const tagAId = randomUUID();
  await databaseService.withTenant(businessAId, async (tx) => {
    await tx.insert(dietaryTags).values({
      id: tagAId,
      businessId: businessAId,
      kind: "dietary",
      code: `rls_tag_${randomUUID().slice(0, 8)}`,
      localizedLabels: { fr: "RLS tag" },
      position: 0,
    });
    await tx.insert(productTags).values({
      businessId: businessAId,
      productId: productAId,
      tagId: tagAId,
    });
    await tx.insert(productAvailabilityWindows).values({
      businessId: businessAId,
      productId: productAId,
      dayOfWeek: 0,
      startMinute: 0,
      endMinute: 120,
    });
  });

  await t.test("tenant A reads its own tag and window rows", async () => {
    assert.ok(await rowCountWithTenant(businessAId, "dietary_tags") > 0);
    assert.ok(await rowCountWithTenant(businessAId, "product_tags") > 0);
    assert.ok(await rowCountWithTenant(businessAId, "product_availability_windows") > 0);
  });

  await t.test("tenant B forged predicates cannot read tenant A tag and window rows", async () => {
    assert.equal(await forgedRowCount(businessBId, "dietary_tags", businessAId), 0);
    assert.equal(await forgedRowCount(businessBId, "product_tags", businessAId), 0);
    assert.equal(await forgedRowCount(businessBId, "product_availability_windows", businessAId), 0);
  });

  await t.test("direct app-role query without tenant context reads zero rows", async () => {
    assert.equal((await appDb.execute(sql`SELECT * FROM dietary_tags`)).rowCount, 0);
    assert.equal((await appDb.execute(sql`SELECT * FROM product_tags`)).rowCount, 0);
    assert.equal((await appDb.execute(sql`SELECT * FROM product_availability_windows`)).rowCount, 0);
  });

  await t.test("tenant A cannot write tenant B tag rows", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(dietaryTags).values({
          businessId: businessBId,
          kind: "dietary",
          code: `bad_${randomUUID().slice(0, 8)}`,
          localizedLabels: { fr: "Bad" },
          position: 0,
        }),
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
  const permissionIds = ["menu.view", "menu.manage"];

  await adminDb
    .insert(permissions)
    .values(
      permissionIds.map((id) => ({
        id,
        description: id,
        category: "menu",
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

function findProduct(
  menu: Awaited<ReturnType<EffectiveMenuResolver["getEffectiveMenu"]>>,
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

async function apiDelete(path: string, token: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "DELETE",
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
