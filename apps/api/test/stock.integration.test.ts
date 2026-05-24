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
  ingredients,
  ingredientUnitConversions,
  permissionVersions,
  permissions,
  productVariants,
  products,
  recipeLines,
  recipes,
  rolePermissions,
  roles,
  stockLevels,
  stockMovements,
  users,
} from "@quickarte/db-schema";
import * as schema from "@quickarte/db-schema";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { ApiJwtService } from "../src/auth/jwt.strategy";
import { ProblemDetailsFilter } from "../src/common/filters/problem-details.filter";
import { DatabaseService } from "../src/database/database.service";
import { StockService } from "../src/stock/stock.service";

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
let stockService: StockService;
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
  branchAId = randomUUID();
  branchBId = randomUUID();
  userAId = randomUUID();
  userBId = randomUUID();

  await adminDb.insert(users).values([
    {
      id: userAId,
      name: "Stock Owner A",
      email: `stock-a-${runId}@example.test`,
      role: "owner",
    },
    {
      id: userBId,
      name: "Stock Owner B",
      email: `stock-b-${runId}@example.test`,
      role: "owner",
    },
  ]);
  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: userAId,
      name: "Stock Tenant A",
      slug: `stock-a-${runId}`,
      type: "restaurant",
    },
    {
      id: businessBId,
      ownerId: userBId,
      name: "Stock Tenant B",
      slug: `stock-b-${runId}`,
      type: "restaurant",
    },
  ]);
  await adminDb.insert(branches).values([
    {
      id: branchAId,
      businessId: businessAId,
      name: "Stock Branch A",
      slug: "main",
      isDefault: true,
    },
    {
      id: branchBId,
      businessId: businessBId,
      name: "Stock Branch B",
      slug: "main",
      isDefault: true,
    },
  ]);
  ownerRoleAId = await seedRolesAndPermissions(businessAId);
  await seedRolesAndPermissions(businessBId);

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
  stockService = app.get(StockService);

  const address = app.getHttpServer().address();
  assert.equal(typeof address, "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await app?.close();
  await appPool?.end();
  await adminPool?.end();
});

test("M4.3 deducts a single ingredient with unit conversion and updates movement plus level exactly", async () => {
  const ingredientId = await createIngredient("Flour single", "g");
  const variantId = await createVariant("Single conversion");
  const recipeId = await createVariantRecipe(variantId);
  await setRecipeLines(recipeId, [
    ingredientLine(ingredientId, "0.2500", "kg"),
  ]);
  await adjust(ingredientId, "1000.0000", "opening");

  const result = await deduct("sale-single", [
    { variantId, quantity: "1.0000" },
  ]);

  assert.equal(result.alreadyDeducted, false);
  assert.deepEqual(result.skipped, []);
  assert.equal(result.deductions.length, 1);
  assert.equal(result.deductions[0].ingredientId, ingredientId);
  assert.equal(result.deductions[0].deductedQty, "250.0000");
  assert.equal(result.deductions[0].resultingLevel, "750.0000");
  assert.deepEqual(result.negatives, []);

  const movementRows = await movementsFor("sale-single");
  assert.equal(movementRows.length, 1);
  assert.equal(movementRows[0].quantityDelta, "-250.0000");
  assert.equal(await levelFor(ingredientId), "750.0000");
});

test("M4.3 cascades through sub-recipes and scales by recipe yield quantity", async () => {
  const ingredientId = await createIngredient("Tomato cascade", "g");
  const sauceId = await createSubRecipe("Tomato sauce", "500.0000", "g");
  await setRecipeLines(sauceId, [
    ingredientLine(ingredientId, "250.0000", "g"),
  ]);
  const variantId = await createVariant("Cascade sandwich");
  const recipeId = await createVariantRecipe(variantId, "1.0000");
  await setRecipeLines(recipeId, [
    subRecipeLine(sauceId, "100.0000", "g"),
  ]);
  await adjust(ingredientId, "1000.0000", "opening");

  const result = await deduct("sale-cascade", [
    { variantId, quantity: "2.0000" },
  ]);

  assert.equal(result.deductions[0].ingredientId, ingredientId);
  assert.equal(result.deductions[0].deductedQty, "100.0000");
  assert.equal(result.deductions[0].resultingLevel, "900.0000");
});

test("M4.3 diamond deduction sums an ingredient through both sub-recipe paths", async () => {
  const ingredientId = await createIngredient("Harissa diamond", "g");
  const baseId = await createSubRecipe("Diamond base", "100.0000", "g");
  const sauceBId = await createSubRecipe("Diamond B", "100.0000", "g");
  const sauceCId = await createSubRecipe("Diamond C", "100.0000", "g");
  await setRecipeLines(baseId, [ingredientLine(ingredientId, "10.0000", "g")]);
  await setRecipeLines(sauceBId, [subRecipeLine(baseId, "100.0000", "g")]);
  await setRecipeLines(sauceCId, [subRecipeLine(baseId, "100.0000", "g")]);
  const variantId = await createVariant("Diamond dish");
  const recipeId = await createVariantRecipe(variantId);
  await setRecipeLines(recipeId, [
    subRecipeLine(sauceBId, "100.0000", "g"),
    subRecipeLine(sauceCId, "100.0000", "g"),
  ]);
  await adjust(ingredientId, "100.0000", "opening");

  const result = await deduct("sale-diamond", [
    { variantId, quantity: "1.0000" },
  ]);

  assert.equal(result.deductions[0].deductedQty, "20.0000");
  assert.equal(result.deductions[0].resultingLevel, "80.0000");
});

test("M4.3 cooked yield expands to raw quantity before deduction", async () => {
  const ingredientId = await createIngredient("Cooked onion", "g");
  const variantId = await createVariant("Yield test");
  const recipeId = await createVariantRecipe(variantId);
  await setRecipeLines(recipeId, [
    ingredientLine(ingredientId, "100.0000", "g", true, "80.0000"),
  ]);
  await adjust(ingredientId, "200.0000", "opening");

  const result = await deduct("sale-yield", [{ variantId, quantity: "1.0000" }]);

  assert.equal(result.deductions[0].deductedQty, "125.0000");
  assert.equal(result.deductions[0].resultingLevel, "75.0000");
});

test("M4.3 allows negative stock, writes the movement, and flags the result", async () => {
  const ingredientId = await createIngredient("Negative flour", "g");
  const variantId = await createVariant("Negative dish");
  const recipeId = await createVariantRecipe(variantId);
  await setRecipeLines(recipeId, [ingredientLine(ingredientId, "125.0000", "g")]);

  const result = await deduct("sale-negative", [{ variantId, quantity: "1.0000" }]);

  assert.equal(result.deductions[0].deductedQty, "125.0000");
  assert.equal(result.deductions[0].resultingLevel, "-125.0000");
  assert.deepEqual(result.negatives, [
    {
      ingredientId,
      resultingLevel: "-125.0000",
    },
  ]);
  assert.equal((await movementsFor("sale-negative")).length, 1);
});

test("M4.3 rolls back all movements and levels when a mid-deduction insert fails", async () => {
  const firstIngredientId = await createIngredient("Atomic first", "g");
  const failingIngredientId = await createIngredient("Atomic sentinel", "g");
  const variantId = await createVariant("Atomic dish");
  const recipeId = await createVariantRecipe(variantId);
  await setRecipeLines(recipeId, [
    ingredientLine(firstIngredientId, "10.0000", "g"),
    ingredientLine(failingIngredientId, "20.0000", "g"),
  ]);
  await adjust(firstIngredientId, "100.0000", "opening");
  await adjust(failingIngredientId, "100.0000", "opening");

  await adminDb.execute(sql.raw(`
    CREATE OR REPLACE FUNCTION fail_stock_movement_for_sentinel()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.reference_id = 'sale-atomic-fail' AND NEW.ingredient_id = '${failingIngredientId}'::uuid THEN
        RAISE EXCEPTION 'forced stock movement failure';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `));
  await adminDb.execute(sql`
    DROP TRIGGER IF EXISTS stock_movements_force_fail ON stock_movements;
    CREATE TRIGGER stock_movements_force_fail
    BEFORE INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION fail_stock_movement_for_sentinel();
  `);

  try {
    await assert.rejects(
      deduct("sale-atomic-fail", [{ variantId, quantity: "1.0000" }]),
      (error) =>
        /forced stock movement failure/i.test(
          error instanceof Error
            ? `${error.message} ${String((error as { cause?: unknown }).cause)}`
            : String(error),
        ),
    );
  } finally {
    await adminDb.execute(sql`DROP TRIGGER IF EXISTS stock_movements_force_fail ON stock_movements`);
    await adminDb.execute(sql`DROP FUNCTION IF EXISTS fail_stock_movement_for_sentinel()`);
  }

  assert.equal((await movementsFor("sale-atomic-fail")).length, 0);
  assert.equal(await levelFor(firstIngredientId), "100.0000");
  assert.equal(await levelFor(failingIngredientId), "100.0000");
});

test("M4.3 sale reference idempotency prevents double deduction on replay", async () => {
  const ingredientId = await createIngredient("Replay flour", "g");
  const variantId = await createVariant("Replay dish");
  const recipeId = await createVariantRecipe(variantId);
  await setRecipeLines(recipeId, [ingredientLine(ingredientId, "25.0000", "g")]);
  await adjust(ingredientId, "100.0000", "opening");

  const first = await deduct("sale-idempotent", [{ variantId, quantity: "1.0000" }]);
  const second = await deduct("sale-idempotent", [{ variantId, quantity: "1.0000" }]);

  assert.equal(first.alreadyDeducted, false);
  assert.equal(second.alreadyDeducted, true);
  assert.equal(await levelFor(ingredientId), "75.0000");
  assert.equal((await movementsFor("sale-idempotent")).length, 1);
});

test("M4.3 skips untracked ingredients and variants without recipes without error", async () => {
  const untrackedId = await createIngredient("Packaging skip", "unit", false);
  const trackedVariantId = await createVariant("Untracked dish");
  const trackedRecipeId = await createVariantRecipe(trackedVariantId);
  await setRecipeLines(trackedRecipeId, [
    ingredientLine(untrackedId, "1.0000", "unit"),
  ]);
  const noRecipeVariantId = await createVariant("No recipe dish");

  const result = await deduct("sale-skips", [
    { variantId: trackedVariantId, quantity: "1.0000" },
    { variantId: noRecipeVariantId, quantity: "1.0000" },
  ]);

  assert.deepEqual(result.deductions, []);
  assert.deepEqual(sortSkipped(result.skipped), sortSkipped([
    { variantId: trackedVariantId, reason: "untracked_ingredient", ingredientId: untrackedId },
    { variantId: noRecipeVariantId, reason: "no_recipe" },
  ]));
  assert.equal((await movementsFor("sale-skips")).length, 0);
});

test("M4.3 reverseForSale appends compensating movements and restores the prior level", async () => {
  const ingredientId = await createIngredient("Reverse flour", "g");
  const variantId = await createVariant("Reverse dish");
  const recipeId = await createVariantRecipe(variantId);
  await setRecipeLines(recipeId, [ingredientLine(ingredientId, "30.0000", "g")]);
  await adjust(ingredientId, "100.0000", "opening");

  await deduct("sale-reverse", [{ variantId, quantity: "1.0000" }]);
  const reverse = await stockService.reverseForSale({
    businessId: businessAId,
    branchId: branchAId,
    referenceType: "sale",
    referenceId: "sale-reverse",
    createdBy: userAId,
  });

  assert.equal(reverse.reversed, true);
  assert.equal(reverse.deductions[0].deductedQty, "30.0000");
  assert.equal(reverse.deductions[0].resultingLevel, "100.0000");
  assert.equal(await levelFor(ingredientId), "100.0000");
});

test("M4.3 stock API lists levels, lists movements, and accepts signed manual adjustments", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const ingredientId = await createIngredient("API level flour", "g");

  const adjustment = await apiPost(`/v1/branches/${branchAId}/stock/adjustments`, token, {
    ingredientId,
    quantityDelta: "42.5000",
    reason: "opening balance",
  });
  assert.equal(adjustment.status, 201, await adjustment.clone().text());
  const adjustmentBody = await adjustment.json() as StockAdjustmentResponse;
  assert.equal(adjustmentBody.movement.quantityDelta, "42.5000");
  assert.equal(adjustmentBody.level.currentQty, "42.5000");

  const levels = await apiGet(`/v1/branches/${branchAId}/stock`, token);
  assert.equal(levels.status, 200, await levels.clone().text());
  const levelsBody = await levels.json() as StockLevelsResponse;
  assert.ok(levelsBody.levels.some((level) => level.ingredientId === ingredientId && level.currentQty === "42.5000"));

  const movementList = await apiGet(`/v1/branches/${branchAId}/stock/movements?ingredientId=${ingredientId}`, token);
  assert.equal(movementList.status, 200, await movementList.clone().text());
  const movementBody = await movementList.json() as StockMovementsResponse;
  assert.ok(movementBody.movements.some((movement) => movement.ingredientId === ingredientId && movement.quantityDelta === "42.5000"));
});

test("M4.3 RLS isolates stock_movements and stock_levels by tenant", async (t) => {
  const ingredientAId = await createIngredient("RLS A", "g");
  const ingredientBId = randomUUID();
  await adminDb.insert(ingredients).values({
    id: ingredientBId,
    businessId: businessBId,
    name: "RLS B",
    category: "dry_good",
    stockUom: "g",
    currentCostPerUom: "1.0000",
  });
  await adminDb.insert(stockMovements).values([
    {
      businessId: businessAId,
      branchId: branchAId,
      ingredientId: ingredientAId,
      quantityDelta: "10.0000",
      movementType: "adjustment",
      reason: "tenant A",
      createdBy: userAId,
    },
    {
      businessId: businessBId,
      branchId: branchBId,
      ingredientId: ingredientBId,
      quantityDelta: "20.0000",
      movementType: "adjustment",
      reason: "tenant B",
      createdBy: userBId,
    },
  ]);
  await adminDb.insert(stockLevels).values([
    {
      businessId: businessAId,
      branchId: branchAId,
      ingredientId: ingredientAId,
      currentQty: "10.0000",
    },
    {
      businessId: businessBId,
      branchId: branchBId,
      ingredientId: ingredientBId,
      currentQty: "20.0000",
    },
  ]);

  await t.test("tenant A reads only its stock movements", async () => {
    const rows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(stockMovements),
    );
    assert.ok(rows.some((row) => row.ingredientId === ingredientAId));
    assert.equal(rows.some((row) => row.ingredientId === ingredientBId), false);
  });

  await t.test("tenant A reads only its stock levels", async () => {
    const rows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(stockLevels),
    );
    assert.ok(rows.some((row) => row.ingredientId === ingredientAId));
    assert.equal(rows.some((row) => row.ingredientId === ingredientBId), false);
  });

  await t.test("direct app-role query without tenant context reads zero stock rows", async () => {
    assert.equal((await appDb.select().from(stockMovements)).length, 0);
    assert.equal((await appDb.select().from(stockLevels)).length, 0);
  });

  await t.test("tenant A cannot insert a level for tenant B", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(stockLevels).values({
          businessId: businessBId,
          branchId: branchBId,
          ingredientId: ingredientBId,
          currentQty: "1.0000",
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
      { id: "stock.view", description: "View stock levels and movements", category: "stock" },
      { id: "stock.adjust", description: "Adjust stock manually", category: "stock" },
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
      { roleId: role.id, permissionId: "stock.view" },
      { roleId: role.id, permissionId: "stock.adjust" },
    ])
    .onConflictDoNothing();
  await adminDb
    .insert(permissionVersions)
    .values({ businessId, version: 1 })
    .onConflictDoNothing();
  return role.id;
}

async function createIngredient(
  name: string,
  stockUom: string,
  trackedInStock = true,
): Promise<string> {
  const id = randomUUID();
  await adminDb.insert(ingredients).values({
    id,
    businessId: businessAId,
    name,
    category: "dry_good",
    stockUom,
    currentCostPerUom: "1.0000",
    trackedInStock,
  });
  if (stockUom === "g") {
    await adminDb
      .insert(ingredientUnitConversions)
      .values({
        businessId: businessAId,
        ingredientId: id,
        altUom: "unit",
        qtyInStockUom: "150.0000",
      })
      .onConflictDoNothing();
  }
  return id;
}

async function createVariant(name: string): Promise<string> {
  const categoryId = randomUUID();
  const productId = randomUUID();
  const variantId = randomUUID();
  await adminDb.insert(categories).values({
    id: categoryId,
    businessId: businessAId,
    name: `Stock category ${name}`,
    slug: `stock-${slugify(name)}-${variantId}`,
    position: 0,
  });
  await adminDb.insert(products).values({
    id: productId,
    businessId: businessAId,
    categoryId,
    name,
    price: "50.00",
  });
  await adminDb.insert(productVariants).values({
    id: variantId,
    productId,
    name: "Standard",
    priceOverride: "50.00",
    isDefault: true,
  });
  return variantId;
}

async function createVariantRecipe(
  variantId: string,
  yieldQty = "1.0000",
): Promise<string> {
  const id = randomUUID();
  await adminDb.insert(recipes).values({
    id,
    businessId: businessAId,
    variantId,
    name: `Recipe ${variantId}`,
    yieldQty,
  });
  return id;
}

async function createSubRecipe(
  name: string,
  yieldQty: string,
  yieldUom: string,
): Promise<string> {
  const id = randomUUID();
  await adminDb.insert(recipes).values({
    id,
    businessId: businessAId,
    name,
    yieldQty,
    yieldUom,
  });
  return id;
}

async function setRecipeLines(recipeId: string, lines: RecipeLineInput[]) {
  await adminDb.delete(recipeLines).where(eq(recipeLines.recipeId, recipeId));
  await adminDb.insert(recipeLines).values(
    lines.map((line, index) => ({
      businessId: businessAId,
      recipeId,
      componentType: line.componentType,
      ingredientId: line.ingredientId ?? null,
      subRecipeId: line.subRecipeId ?? null,
      quantity: line.quantity,
      uom: line.uom,
      yieldPct: line.yieldPct ?? null,
      quantityIsCooked: line.quantityIsCooked ?? false,
      position: index,
    })),
  );
}

function ingredientLine(
  ingredientId: string,
  quantity: string,
  uom: string,
  quantityIsCooked = false,
  yieldPct: string | null = null,
): RecipeLineInput {
  return {
    componentType: "ingredient",
    ingredientId,
    quantity,
    uom,
    quantityIsCooked,
    yieldPct,
  };
}

function subRecipeLine(
  subRecipeId: string,
  quantity: string,
  uom: string,
): RecipeLineInput {
  return {
    componentType: "sub_recipe",
    subRecipeId,
    quantity,
    uom,
  };
}

async function adjust(ingredientId: string, quantityDelta: string, reason: string) {
  await stockService.adjustStock({
    businessId: businessAId,
    branchId: branchAId,
    ingredientId,
    quantityDelta,
    reason,
    createdBy: userAId,
  });
}

function deduct(referenceId: string, lines: Array<{ variantId: string; quantity: string }>) {
  return stockService.deductForSale({
    businessId: businessAId,
    branchId: branchAId,
    referenceType: "sale",
    referenceId,
    createdBy: userAId,
    lines,
  });
}

async function movementsFor(referenceId: string) {
  return adminDb
    .select()
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.businessId, businessAId),
        eq(stockMovements.referenceType, "sale"),
        eq(stockMovements.referenceId, referenceId),
      ),
    )
    .orderBy(stockMovements.createdAt);
}

async function levelFor(ingredientId: string): Promise<string | null> {
  const [row] = await adminDb
    .select({ currentQty: stockLevels.currentQty })
    .from(stockLevels)
    .where(
      and(
        eq(stockLevels.businessId, businessAId),
        eq(stockLevels.branchId, branchAId),
        eq(stockLevels.ingredientId, ingredientId),
      ),
    )
    .limit(1);
  return row?.currentQty ?? null;
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

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type RecipeLineInput = {
  componentType: "ingredient" | "sub_recipe";
  ingredientId?: string;
  subRecipeId?: string;
  quantity: string;
  uom: string;
  yieldPct?: string | null;
  quantityIsCooked?: boolean;
};

type StockAdjustmentResponse = {
  movement: {
    ingredientId: string;
    quantityDelta: string;
  };
  level: {
    ingredientId: string;
    currentQty: string;
  };
};

type StockLevelsResponse = {
  levels: Array<{
    ingredientId: string;
    currentQty: string;
  }>;
};

type StockMovementsResponse = {
  movements: Array<{
    ingredientId: string;
    quantityDelta: string;
  }>;
};

function sortSkipped<T extends { variantId: string; reason: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => `${a.reason}:${a.variantId}`.localeCompare(`${b.reason}:${b.variantId}`));
}
