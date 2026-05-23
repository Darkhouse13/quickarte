import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  businesses,
  dietaryTags,
  ingredientTags,
  ingredientUnitConversions,
  ingredients,
  permissionVersions,
  permissions,
  rolePermissions,
  roles,
  users,
} from "@quickarte/db-schema";
import * as schema from "@quickarte/db-schema";
import { sql } from "drizzle-orm";
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
let userAId: string;
let userBId: string;
let ownerRoleAId: string;
let tagAId: string;

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
  tagAId = randomUUID();

  await adminDb.insert(users).values([
    { id: userAId, name: "Ingredient Owner A", email: `ingredients-a-${runId}@example.test`, role: "owner" },
    { id: userBId, name: "Ingredient Owner B", email: `ingredients-b-${runId}@example.test`, role: "owner" },
  ]);
  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: userAId,
      name: "Ingredients Tenant A",
      slug: `ingredients-a-${runId}`,
      type: "restaurant",
    },
    {
      id: businessBId,
      ownerId: userBId,
      name: "Ingredients Tenant B",
      slug: `ingredients-b-${runId}`,
      type: "restaurant",
    },
  ]);
  ownerRoleAId = await seedRolesAndPermissions(businessAId);
  await seedRolesAndPermissions(businessBId);
  await adminDb.insert(dietaryTags).values({
    id: tagAId,
    businessId: businessAId,
    kind: "allergen",
    code: `contains_nuts_${runId.replace(/-/g, "_")}`,
    localizedLabels: { fr: "Fruits a coque" },
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

test("M4.1 units endpoint returns global reference units with decimal-string factors", async () => {
  const response = await apiGet("/v1/units", tokenFor(businessAId, userAId, ownerRoleAId));
  assert.equal(response.status, 200);
  const body = await response.json() as { units: Array<{ code: string; factorToBase: string }> };
  assert.ok(body.units.find((unit) => unit.code === "kg" && unit.factorToBase === "1000"));
  assert.equal(typeof body.units[0]?.factorToBase, "string");
});

test("M4.1 ingredient CRUD validates decimal-string cost, soft-delete, conversions, and tags", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);

  const invalidCost = await apiPost("/v1/ingredients", token, {
    name: "Invalid Cost",
    stockUom: "kg",
    currentCostPerUom: "-1.00",
  });
  assert.equal(invalidCost.status, 400, await invalidCost.text());

  const createResponse = await apiPost("/v1/ingredients", token, {
    name: "Oignon",
    localizedNames: { fr: "Oignon", ar: "بصل" },
    category: "vegetable",
    stockUom: "g",
    currentCostPerUom: "8.50",
    trackedInStock: true,
    storageLocation: "Reserve seche",
    position: 2,
  });
  assert.equal(createResponse.status, 201, await createResponse.clone().text());
  const createBody = await createResponse.json() as { ingredient: { id: string; currentCostPerUom: string } };
  assert.equal(createBody.ingredient.currentCostPerUom, "8.50");

  const conversionsResponse = await apiPut(`/v1/ingredients/${createBody.ingredient.id}/conversions`, token, {
    conversions: [{ altUom: "unit", qtyInStockUom: "150.0000" }],
  });
  assert.equal(conversionsResponse.status, 200, await conversionsResponse.clone().text());
  const conversionsBody = await conversionsResponse.json() as { conversions: Array<{ qtyInStockUom: string }> };
  assert.equal(conversionsBody.conversions[0]?.qtyInStockUom, "150.0000");

  const tagsResponse = await apiPut(`/v1/ingredients/${createBody.ingredient.id}/tags`, token, {
    tagIds: [tagAId],
  });
  assert.equal(tagsResponse.status, 200, await tagsResponse.clone().text());
  const tagsBody = await tagsResponse.json() as { tags: Array<{ id: string; code: string }> };
  assert.equal(tagsBody.tags[0]?.id, tagAId);

  const listResponse = await apiGet("/v1/ingredients", token);
  assert.equal(listResponse.status, 200);
  const listBody = await listResponse.json() as { ingredients: Array<{ id: string; tags: unknown[] }> };
  assert.ok(listBody.ingredients.find((ingredient) => ingredient.id === createBody.ingredient.id));

  const deleteResponse = await apiDelete(`/v1/ingredients/${createBody.ingredient.id}`, token);
  assert.equal(deleteResponse.status, 200);
  const getDeletedResponse = await apiGet(`/v1/ingredients/${createBody.ingredient.id}`, token);
  assert.equal(getDeletedResponse.status, 404);
});

test("M4.1 ingredient RLS isolates ingredients, conversions, and tags by tenant", async (t) => {
  const ingredientAId = randomUUID();
  const ingredientBId = randomUUID();
  const tagBId = randomUUID();

  await adminDb.insert(dietaryTags).values({
    id: tagBId,
    businessId: businessBId,
    kind: "allergen",
    code: `tenant_b_allergen_${randomUUID().replace(/-/g, "_")}`,
    localizedLabels: { fr: "Tenant B allergen" },
    position: 0,
  });
  await adminDb.insert(ingredients).values([
    {
      id: ingredientAId,
      businessId: businessAId,
      name: "Tenant A farine",
      category: "dry_good",
      stockUom: "kg",
      currentCostPerUom: "12.50",
    },
    {
      id: ingredientBId,
      businessId: businessBId,
      name: "Tenant B secret",
      category: "spice",
      stockUom: "g",
      currentCostPerUom: "90.00",
    },
  ]);
  await adminDb.insert(ingredientUnitConversions).values([
    {
      businessId: businessAId,
      ingredientId: ingredientAId,
      altUom: "unit",
      qtyInStockUom: "250.0000",
    },
    {
      businessId: businessBId,
      ingredientId: ingredientBId,
      altUom: "unit",
      qtyInStockUom: "10.0000",
    },
  ]);
  await adminDb.insert(ingredientTags).values([
    { businessId: businessAId, ingredientId: ingredientAId, tagId: tagAId },
    { businessId: businessBId, ingredientId: ingredientBId, tagId: tagBId },
  ]);

  await t.test("tenant A reads only its ingredients", async () => {
    const rows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(ingredients),
    );
    assert.ok(rows.some((row) => row.id === ingredientAId));
    assert.equal(rows.some((row) => row.id === ingredientBId), false);
  });

  await t.test("tenant A reads only its ingredient conversions", async () => {
    const rows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(ingredientUnitConversions),
    );
    assert.ok(rows.some((row) => row.ingredientId === ingredientAId));
    assert.equal(rows.some((row) => row.ingredientId === ingredientBId), false);
  });

  await t.test("tenant A reads only its ingredient tags", async () => {
    const rows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(ingredientTags),
    );
    assert.ok(rows.some((row) => row.ingredientId === ingredientAId));
    assert.equal(rows.some((row) => row.ingredientId === ingredientBId), false);
  });

  await t.test("tenant A cannot insert an ingredient for tenant B", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(ingredients).values({
          businessId: businessBId,
          name: "Forged",
          category: "spice",
          stockUom: "g",
        }),
      ),
      (error) =>
        /row-level security|violates row-level security/i.test(
          error instanceof Error
            ? `${error.message} ${String((error as { cause?: unknown }).cause)}`
            : String(error),
        ),
    );
  });
});

async function seedRolesAndPermissions(businessId: string): Promise<string> {
  await adminDb
    .insert(permissions)
    .values([
      { id: "ingredient.view", description: "View ingredients", category: "ingredients" },
      { id: "ingredient.manage", description: "Manage ingredients", category: "ingredients" },
    ])
    .onConflictDoNothing();
  const [role] = await adminDb
    .insert(roles)
    .values({ businessId, name: "Owner", isSystem: true })
    .onConflictDoUpdate({
      target: [roles.businessId, roles.name],
      set: { isSystem: true },
    })
    .returning({ id: roles.id });
  assert.ok(role);
  await adminDb
    .insert(rolePermissions)
    .values([
      { roleId: role.id, permissionId: "ingredient.view" },
      { roleId: role.id, permissionId: "ingredient.manage" },
    ])
    .onConflictDoNothing();
  await adminDb
    .insert(permissionVersions)
    .values({ businessId, version: 1 })
    .onConflictDoNothing();
  return role.id;
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

function apiGet(path: string, token: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

function apiPost(path: string, token: string, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function apiPut(path: string, token: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function apiDelete(path: string, token: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
}
