import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  businesses,
  categories,
  ingredientUnitConversions,
  ingredients,
  permissionVersions,
  permissions,
  productVariants,
  products,
  recipeLines,
  recipes,
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
let variantAId: string;
let ingredientFlourId: string;
let ingredientOnionId: string;
let ingredientUnknownCostId: string;

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
  variantAId = randomUUID();
  ingredientFlourId = randomUUID();
  ingredientOnionId = randomUUID();
  ingredientUnknownCostId = randomUUID();

  await adminDb.insert(users).values([
    { id: userAId, name: "Recipe Owner A", email: `recipes-a-${runId}@example.test`, role: "owner" },
    { id: userBId, name: "Recipe Owner B", email: `recipes-b-${runId}@example.test`, role: "owner" },
  ]);
  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: userAId,
      name: "Recipe Tenant A",
      slug: `recipes-a-${runId}`,
      type: "restaurant",
    },
    {
      id: businessBId,
      ownerId: userBId,
      name: "Recipe Tenant B",
      slug: `recipes-b-${runId}`,
      type: "restaurant",
    },
  ]);
  ownerRoleAId = await seedRolesAndPermissions(businessAId);
  await seedRolesAndPermissions(businessBId);

  const categoryId = randomUUID();
  const productId = randomUUID();
  await adminDb.insert(categories).values({
    id: categoryId,
    businessId: businessAId,
    name: "Recipes",
    slug: `recipes-${runId}`,
    position: 0,
  });
  await adminDb.insert(products).values({
    id: productId,
    businessId: businessAId,
    categoryId,
    name: "Test Sandwich",
    price: "45.00",
  });
  await adminDb.insert(productVariants).values({
    id: variantAId,
    productId,
    name: "Standard",
    priceOverride: "45.00",
    isDefault: true,
  });

  await adminDb.insert(ingredients).values([
    {
      id: ingredientFlourId,
      businessId: businessAId,
      name: "Farine",
      category: "dry_good",
      stockUom: "g",
      currentCostPerUom: "0.0200",
    },
    {
      id: ingredientOnionId,
      businessId: businessAId,
      name: "Oignon",
      category: "vegetable",
      stockUom: "g",
      currentCostPerUom: "0.0300",
    },
    {
      id: ingredientUnknownCostId,
      businessId: businessAId,
      name: "Safran",
      category: "spice",
      stockUom: "g",
      currentCostPerUom: null,
    },
  ]);
  await adminDb.insert(ingredientUnitConversions).values({
    businessId: businessAId,
    ingredientId: ingredientOnionId,
    altUom: "unit",
    qtyInStockUom: "150.0000",
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

test("M4.2 cycle detection rejects self-reference, direct cycles, and transitive cycles", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const recipeA = await createSubRecipe(token, "Sauce A");
  const recipeB = await createSubRecipe(token, "Sauce B");
  const recipeC = await createSubRecipe(token, "Sauce C");

  const self = await replaceLines(token, recipeA.id, [
    subRecipeLine(recipeA.id, "1.0000", "g"),
  ]);
  const selfBody = await self.text();
  assert.equal(self.status, 409, selfBody);
  assert.match(selfBody, /recipe-cycle-detected|cycle/i);

  assert.equal((await replaceLines(token, recipeA.id, [subRecipeLine(recipeB.id, "1.0000", "g")])).status, 200);
  const direct = await replaceLines(token, recipeB.id, [subRecipeLine(recipeA.id, "1.0000", "g")]);
  const directBody = await direct.text();
  assert.equal(direct.status, 409, directBody);
  assert.match(directBody, /Sauce A|cycle/i);

  assert.equal((await replaceLines(token, recipeB.id, [subRecipeLine(recipeC.id, "1.0000", "g")])).status, 200);
  const transitive = await replaceLines(token, recipeC.id, [subRecipeLine(recipeA.id, "1.0000", "g")]);
  const transitiveBody = await transitive.text();
  assert.equal(transitive.status, 409, transitiveBody);
  assert.match(transitiveBody, /Sauce A|cycle/i);
});

test("M4.2 cost cascade computes ingredient, sub-recipe, total, yield, null-cost, and food-cost percentage", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const subRecipe = await createSubRecipe(token, "Harissa", "500.0000", "g");
  const variantRecipe = await createVariantRecipe(token, variantAId);

  const subResult = await replaceLines(token, subRecipe.id, [
    ingredientLine(ingredientFlourId, "0.2500", "kg"),
  ]);
  assert.equal(subResult.status, 200, await subResult.clone().text());
  const subBody = await subResult.json() as { recipe: RecipeSummary };
  assert.equal(subBody.recipe.computedCost, "5.0000");
  assert.equal(subBody.recipe.costIsComplete, true);
  assert.equal(subBody.recipe.foodCostPct, null);

  const variantResult = await replaceLines(token, variantRecipe.id, [
    ingredientLine(ingredientOnionId, "100.0000", "g", true, "80.0000"),
    subRecipeLine(subRecipe.id, "100.0000", "g"),
    ingredientLine(ingredientUnknownCostId, "1.0000", "g"),
  ]);
  assert.equal(variantResult.status, 200, await variantResult.clone().text());
  const variantBody = await variantResult.json() as { recipe: RecipeSummary };
  assert.equal(variantBody.recipe.computedCost, "4.7500");
  assert.equal(variantBody.recipe.costIsComplete, false);
  assert.equal(variantBody.recipe.foodCostPct, null);

  const updateIngredient = await apiPatch(`/v1/ingredients/${ingredientUnknownCostId}`, token, {
    currentCostPerUom: "1.0000",
  });
  assert.equal(updateIngredient.status, 200, await updateIngredient.text());
  const refreshed = await apiGet(`/v1/recipes/${variantRecipe.id}`, token);
  assert.equal(refreshed.status, 200, await refreshed.clone().text());
  const refreshedBody = await refreshed.json() as { recipe: RecipeSummary };
  assert.equal(refreshedBody.recipe.computedCost, "5.7500");
  assert.equal(refreshedBody.recipe.costIsComplete, true);
  assert.equal(refreshedBody.recipe.foodCostPct, "12.7778");

  const subUpdate = await replaceLines(token, subRecipe.id, [
    ingredientLine(ingredientFlourId, "0.5000", "kg"),
  ]);
  assert.equal(subUpdate.status, 200, await subUpdate.clone().text());
  const refreshedAfterSubChange = await apiGet(`/v1/recipes/${variantRecipe.id}`, token);
  const refreshedAfterSubChangeBody = await refreshedAfterSubChange.json() as { recipe: RecipeSummary };
  assert.equal(refreshedAfterSubChangeBody.recipe.computedCost, "6.7500");
  assert.equal(refreshedAfterSubChangeBody.recipe.foodCostPct, "15.0000");
});

test("M4.2 cost cascade recomputes diamond ancestors after all shared descendants are fresh", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const base = await createSubRecipe(token, "Diamond Base", "100.0000", "g");
  const sauceB = await createSubRecipe(token, "Diamond Sauce B", "100.0000", "g");
  const sauceC = await createSubRecipe(token, "Diamond Sauce C", "100.0000", "g");
  const parent = await createSubRecipe(token, "Diamond Parent", "100.0000", "g");

  assert.equal(
    (await replaceLines(token, base.id, [
      ingredientLine(ingredientFlourId, "100.0000", "g"),
    ])).status,
    200,
  );
  assert.equal(
    (await replaceLines(token, sauceB.id, [subRecipeLine(base.id, "100.0000", "g")]))
      .status,
    200,
  );
  assert.equal(
    (await replaceLines(token, sauceC.id, [subRecipeLine(base.id, "100.0000", "g")]))
      .status,
    200,
  );
  assert.equal(
    (await replaceLines(token, parent.id, [
      subRecipeLine(sauceB.id, "100.0000", "g"),
      subRecipeLine(sauceC.id, "100.0000", "g"),
    ])).status,
    200,
  );

  const initialParent = await apiGet(`/v1/recipes/${parent.id}`, token);
  const initialParentBody = await initialParent.json() as { recipe: RecipeSummary };
  assert.equal(initialParentBody.recipe.computedCost, "4.0000");

  const baseUpdate = await replaceLines(token, base.id, [
    ingredientLine(ingredientFlourId, "200.0000", "g"),
  ]);
  assert.equal(baseUpdate.status, 200, await baseUpdate.clone().text());

  const refreshedB = await apiGet(`/v1/recipes/${sauceB.id}`, token);
  const refreshedBBody = await refreshedB.json() as { recipe: RecipeSummary };
  assert.equal(refreshedBBody.recipe.computedCost, "4.0000");

  const refreshedC = await apiGet(`/v1/recipes/${sauceC.id}`, token);
  const refreshedCBody = await refreshedC.json() as { recipe: RecipeSummary };
  assert.equal(refreshedCBody.recipe.computedCost, "4.0000");

  const refreshedParent = await apiGet(`/v1/recipes/${parent.id}`, token);
  const refreshedParentBody = await refreshedParent.json() as { recipe: RecipeSummary };
  assert.equal(refreshedParentBody.recipe.computedCost, "8.0000");
});

test("M4.2 RLS isolates recipes and recipe_lines by tenant", async (t) => {
  const recipeAId = randomUUID();
  const recipeBId = randomUUID();
  await adminDb.insert(recipes).values([
    {
      id: recipeAId,
      businessId: businessAId,
      name: "Tenant A recipe",
      yieldQty: "1.0000",
      yieldUom: "g",
    },
    {
      id: recipeBId,
      businessId: businessBId,
      name: "Tenant B recipe",
      yieldQty: "1.0000",
      yieldUom: "g",
    },
  ]);
  await adminDb.insert(recipeLines).values([
    {
      businessId: businessAId,
      recipeId: recipeAId,
      componentType: "ingredient",
      ingredientId: ingredientFlourId,
      quantity: "1.0000",
      uom: "g",
    },
    {
      businessId: businessBId,
      recipeId: recipeBId,
      componentType: "sub_recipe",
      subRecipeId: recipeBId,
      quantity: "1.0000",
      uom: "g",
    },
  ]);

  await t.test("tenant A reads only its recipes", async () => {
    const rows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(recipes),
    );
    assert.ok(rows.some((row) => row.id === recipeAId));
    assert.equal(rows.some((row) => row.id === recipeBId), false);
  });

  await t.test("tenant A reads only its recipe lines", async () => {
    const rows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(recipeLines),
    );
    assert.ok(rows.some((row) => row.recipeId === recipeAId));
    assert.equal(rows.some((row) => row.recipeId === recipeBId), false);
  });

  await t.test("direct app-role query without tenant context reads zero recipe rows", async () => {
    const rows = await appDb.select().from(recipes);
    assert.equal(rows.length, 0);
  });

  await t.test("tenant A cannot insert a recipe for tenant B", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(recipes).values({
          businessId: businessBId,
          name: "Forged",
          yieldQty: "1.0000",
          yieldUom: "g",
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

test("M4.2 enforces one active recipe per variant and blocks referenced sub-recipe deletion", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const freshVariantId = await createFreshVariant();
  const first = await createVariantRecipe(token, freshVariantId);
  const duplicate = await apiPost("/v1/recipes", token, {
    variantId: freshVariantId,
    name: "Duplicate",
    yieldQty: "1.0000",
  });
  assert.equal(duplicate.status, 409, await duplicate.text());

  const subRecipe = await createSubRecipe(token, "Referenced Sauce");
  assert.equal((await replaceLines(token, first.id, [subRecipeLine(subRecipe.id, "1.0000", "g")])).status, 200);
  const deleteReferenced = await apiDelete(`/v1/recipes/${subRecipe.id}`, token);
  assert.equal(deleteReferenced.status, 409, await deleteReferenced.text());
});

async function seedRolesAndPermissions(businessId: string): Promise<string> {
  await adminDb
    .insert(permissions)
    .values([
      { id: "recipe.view", description: "View recipes", category: "recipes" },
      { id: "recipe.manage", description: "Manage recipes", category: "recipes" },
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
      { roleId: role.id, permissionId: "recipe.view" },
      { roleId: role.id, permissionId: "recipe.manage" },
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

async function createFreshVariant(): Promise<string> {
  const categoryId = randomUUID();
  const productId = randomUUID();
  const variantId = randomUUID();
  await adminDb.insert(categories).values({
    id: categoryId,
    businessId: businessAId,
    name: `Recipe category ${variantId}`,
    slug: `recipe-category-${variantId}`,
    position: 0,
  });
  await adminDb.insert(products).values({
    id: productId,
    businessId: businessAId,
    categoryId,
    name: `Recipe product ${variantId}`,
    price: "45.00",
  });
  await adminDb.insert(productVariants).values({
    id: variantId,
    productId,
    name: "Standard",
    priceOverride: "45.00",
    isDefault: true,
  });
  return variantId;
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

async function createSubRecipe(
  token: string,
  name: string,
  yieldQty = "1.0000",
  yieldUom = "g",
): Promise<RecipeSummary> {
  const response = await apiPost("/v1/recipes", token, {
    name,
    yieldQty,
    yieldUom,
  });
  assert.equal(response.status, 201, await response.clone().text());
  const body = await response.json() as { recipe: RecipeSummary };
  return body.recipe;
}

async function createVariantRecipe(token: string, variantId: string): Promise<RecipeSummary> {
  const response = await apiPost("/v1/recipes", token, {
    variantId,
    name: "Variant Recipe",
    yieldQty: "1.0000",
  });
  assert.equal(response.status, 201, await response.clone().text());
  const body = await response.json() as { recipe: RecipeSummary };
  return body.recipe;
}

function ingredientLine(
  ingredientId: string,
  quantity: string,
  uom: string,
  quantityIsCooked = false,
  yieldPct: string | null = null,
) {
  return {
    componentType: "ingredient",
    ingredientId,
    quantity,
    uom,
    quantityIsCooked,
    yieldPct,
  };
}

function subRecipeLine(subRecipeId: string, quantity: string, uom: string) {
  return {
    componentType: "sub_recipe",
    subRecipeId,
    quantity,
    uom,
  };
}

function replaceLines(
  token: string,
  recipeId: string,
  lines: unknown[],
): Promise<Response> {
  return apiPut(`/v1/recipes/${recipeId}/lines`, token, { lines });
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

function apiPatch(path: string, token: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
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

type RecipeSummary = {
  id: string;
  computedCost: string;
  costIsComplete: boolean;
  foodCostPct: string | null;
};
