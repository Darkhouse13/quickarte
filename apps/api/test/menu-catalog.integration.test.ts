import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  branchOptionValueOverrides,
  branches,
  businesses,
  categories,
  categoryModifierGroups,
  menuLocaleSettings,
  modifierGroupTemplates,
  modifierValueTemplates,
  optionValues,
  permissionVersions,
  permissions,
  productImages,
  productOptions,
  products,
  productVariants,
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
let userAId: string;
let userBId: string;
let ownerRoleAId: string;
let ownerRoleBId: string;
let categoryAId: string;
let categoryBId: string;
let productAId: string;
let productBId: string;
let branchAId: string;

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
    { id: userAId, name: "Menu Owner A", email: `menu-a-${runId}@example.test`, role: "owner" },
    { id: userBId, name: "Menu Owner B", email: `menu-b-${runId}@example.test`, role: "owner" },
  ]);
  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: userAId,
      name: "Menu Tenant A",
      slug: `menu-a-${runId}`,
      type: "restaurant",
    },
    {
      id: businessBId,
      ownerId: userBId,
      name: "Menu Tenant B",
      slug: `menu-b-${runId}`,
      type: "restaurant",
    },
  ]);
  await seedRolesAndPermissions(businessAId);
  await seedRolesAndPermissions(businessBId);

  const [branchA] = await adminDb
    .insert(branches)
    .values({
      businessId: businessAId,
      name: "Tenant A Main",
      slug: `menu-main-${runId}`,
      isDefault: true,
    })
    .returning({ id: branches.id });
  assert.ok(branchA);
  branchAId = branchA.id;

  const [categoryA] = await adminDb
    .insert(categories)
    .values({
      businessId: businessAId,
      name: "Tenant A Grillades",
      slug: `grillades-${runId}`,
      localizedNames: { fr: "Grillades" },
      position: 0,
    })
    .returning({ id: categories.id });
  const [categoryB] = await adminDb
    .insert(categories)
    .values({
      businessId: businessBId,
      name: "Tenant B Secrets",
      slug: `secrets-${runId}`,
      localizedNames: { fr: "Secrets" },
      position: 0,
    })
    .returning({ id: categories.id });
  assert.ok(categoryA);
  assert.ok(categoryB);
  categoryAId = categoryA.id;
  categoryBId = categoryB.id;

  const [productA] = await adminDb
    .insert(products)
    .values({
      businessId: businessAId,
      categoryId: categoryAId,
      name: "Poulet entier",
      price: "95.00",
      localizedNames: { fr: "Poulet entier" },
      position: 0,
    })
    .returning({ id: products.id });
  const [productB] = await adminDb
    .insert(products)
    .values({
      businessId: businessBId,
      categoryId: categoryBId,
      name: "Tenant B Pastilla",
      price: "120.00",
      localizedNames: { fr: "Pastilla" },
      position: 0,
    })
    .returning({ id: products.id });
  assert.ok(productA);
  assert.ok(productB);
  productAId = productA.id;
  productBId = productB.id;

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

test("M3.1 RLS isolates menu_locale_settings and product_images", async (t) => {
  await databaseService.withTenant(businessAId, async (tx) => {
    await tx.insert(menuLocaleSettings).values({
      businessId: businessAId,
      activeLocales: ["fr", "ar"],
      defaultLocale: "fr",
    });
    await tx.insert(productImages).values({
      businessId: businessAId,
      productId: productAId,
      url: "https://cdn.example.test/a.jpg",
      altText: "Tenant A",
      position: 0,
      isPrimary: true,
    });
  });

  await t.test("tenant A reads only its own RLS menu rows", async () => {
    const localeRows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(menuLocaleSettings),
    );
    const imageRows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(productImages),
    );
    assert.equal(localeRows.length, 1);
    assert.equal(imageRows.length, 1);
    assert.equal(imageRows[0]?.businessId, businessAId);
  });

  await t.test("tenant B forged predicates cannot read tenant A RLS rows", async () => {
    const localeRows = await databaseService.withTenant(businessBId, (tx) =>
      tx
        .select()
        .from(menuLocaleSettings)
        .where(eq(menuLocaleSettings.businessId, businessAId)),
    );
    const imageRows = await databaseService.withTenant(businessBId, (tx) =>
      tx.select().from(productImages).where(eq(productImages.businessId, businessAId)),
    );
    assert.equal(localeRows.length, 0);
    assert.equal(imageRows.length, 0);
  });

  await t.test("direct app-role query without tenant context reads zero rows", async () => {
    assert.equal((await appDb.select().from(menuLocaleSettings)).length, 0);
    assert.equal((await appDb.select().from(productImages)).length, 0);
  });

  await t.test("tenant A cannot insert tenant B product image", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(productImages).values({
          businessId: businessBId,
          productId: productBId,
          url: "https://cdn.example.test/bad.jpg",
          position: 1,
        }),
      ),
      (error) =>
        /row-level security policy|violates row-level security/i.test(
          `${String(error)} ${String((error as { cause?: unknown }).cause)}`,
        ),
    );
  });
});

test("menu API explicitly filters shared catalog tables by business_id", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);
  const tokenB = tokenFor(businessBId, userBId, ownerRoleBId);

  const listA = await apiGet("/v1/menu/products?hidden=true", tokenA);
  const listABody = (await listA.json()) as {
    products: Array<{ id: string; name: string; variants: Array<{ synthetic: boolean; price: string }> }>;
  };
  assert.equal(listA.status, 200, JSON.stringify(listABody));
  assert.ok(listABody.products.some((product) => product.id === productAId));
  assert.ok(listABody.products.every((product) => product.id !== productBId));

  const synthetic = listABody.products.find((product) => product.id === productAId)?.variants[0];
  assert.equal(synthetic?.synthetic, true);
  assert.equal(synthetic?.price, "95.00");

  const forgedRead = await apiGet(`/v1/menu/products/${productBId}`, tokenA);
  assert.equal(forgedRead.status, 404, await forgedRead.text());

  const forgedUpdate = await apiJson(
    `/v1/menu/products/${productAId}`,
    "PATCH",
    tokenB,
    { localizedNames: { fr: "Cross tenant overwrite" } },
  );
  assert.equal(forgedUpdate.status, 404, await forgedUpdate.text());
});

test("menu API creates products with first-class fixed variants and keeps legacy fallbacks", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);
  const response = await apiJson("/v1/menu/products", "POST", tokenA, {
    categoryId: categoryAId,
    localizedNames: { fr: "Couscous" },
    localizedDescriptions: { fr: "Chaque vendredi" },
    basePrice: "80.00",
    sku: "COUS-FRI",
    itemCode: "C001",
    colorTag: "#B8543A",
    featured: true,
    hidden: false,
    available: true,
    channels: {
      dineIn: true,
      takeaway: true,
      delivery: false,
      qr: true,
      online: false,
    },
    position: 1,
    variants: [
      {
        name: "Poulet",
        price: "80.00",
        isDefault: true,
        available: true,
        position: 0,
        variantKind: "protein",
        pricingMode: "fixed",
      },
      {
        name: "Agneau",
        price: "120.00",
        isDefault: false,
        available: true,
        position: 1,
        variantKind: "protein",
        pricingMode: "fixed",
      },
    ],
    images: [
      {
        url: "https://cdn.example.test/couscous.jpg",
        altText: "Couscous",
        position: 0,
        isPrimary: true,
      },
    ],
  });

  const body = (await response.json()) as {
    product: { id: string; name: string; image: string; variants: Array<{ price: string; synthetic: boolean }> };
  };
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.product.name, "Couscous");
  assert.equal(body.product.image, "https://cdn.example.test/couscous.jpg");
  assert.deepEqual(
    body.product.variants.map((variant) => [variant.price, variant.synthetic]),
    [
      ["80.00", false],
      ["120.00", false],
    ],
  );

  const [legacyProduct] = await adminDb
    .select({ name: products.name, description: products.description, image: products.image })
    .from(products)
    .where(eq(products.id, body.product.id));
  assert.deepEqual(legacyProduct, {
    name: "Couscous",
    description: "Chaque vendredi",
    image: "https://cdn.example.test/couscous.jpg",
  });

  const variantRows = await adminDb
    .select({ priceOverride: productVariants.priceOverride })
    .from(productVariants)
    .where(eq(productVariants.productId, body.product.id));
  assert.deepEqual(variantRows.map((row) => row.priceOverride), ["80.00", "120.00"]);
});

test("M3.2 RLS isolates modifier templates and category attachments", async (t) => {
  const groupAId = randomUUID();
  const valueAId = randomUUID();

  await databaseService.withTenant(businessAId, async (tx) => {
    await tx.insert(modifierGroupTemplates).values({
      id: groupAId,
      businessId: businessAId,
      name: "Sauce au choix",
      localizedNames: { fr: "Sauce au choix" },
      type: "single_select",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      attachScope: "category",
    });
    await tx.insert(modifierValueTemplates).values({
      id: valueAId,
      businessId: businessAId,
      groupTemplateId: groupAId,
      name: "Harissa",
      localizedNames: { fr: "Harissa" },
      priceAddition: "0.00",
      position: 0,
    });
    await tx.insert(categoryModifierGroups).values({
      businessId: businessAId,
      categoryId: categoryAId,
      groupTemplateId: groupAId,
      position: 0,
    });
  });

  await t.test("tenant A reads its own modifier rows", async () => {
    const groups = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(modifierGroupTemplates),
    );
    const values = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(modifierValueTemplates),
    );
    const attachments = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(categoryModifierGroups),
    );
    assert.ok(groups.some((row) => row.id === groupAId));
    assert.ok(values.some((row) => row.id === valueAId));
    assert.ok(attachments.some((row) => row.groupTemplateId === groupAId));
  });

  await t.test("tenant B forged predicates cannot read tenant A modifier rows", async () => {
    const groups = await databaseService.withTenant(businessBId, (tx) =>
      tx
        .select()
        .from(modifierGroupTemplates)
        .where(eq(modifierGroupTemplates.businessId, businessAId)),
    );
    const values = await databaseService.withTenant(businessBId, (tx) =>
      tx
        .select()
        .from(modifierValueTemplates)
        .where(eq(modifierValueTemplates.businessId, businessAId)),
    );
    const attachments = await databaseService.withTenant(businessBId, (tx) =>
      tx
        .select()
        .from(categoryModifierGroups)
        .where(eq(categoryModifierGroups.businessId, businessAId)),
    );
    assert.equal(groups.length, 0);
    assert.equal(values.length, 0);
    assert.equal(attachments.length, 0);
  });

  await t.test("direct app-role query without tenant context reads zero rows", async () => {
    assert.equal((await appDb.select().from(modifierGroupTemplates)).length, 0);
    assert.equal((await appDb.select().from(modifierValueTemplates)).length, 0);
    assert.equal((await appDb.select().from(categoryModifierGroups)).length, 0);
  });

  await t.test("tenant A cannot attach tenant B category modifier rows", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(categoryModifierGroups).values({
          businessId: businessBId,
          categoryId: categoryBId,
          groupTemplateId: groupAId,
          position: 1,
        }),
      ),
      (error) =>
        /row-level security policy|violates row-level security/i.test(
          `${String(error)} ${String((error as { cause?: unknown }).cause)}`,
        ),
    );
  });
});

test("menu modifier API materializes reusable groups without leaking shared option rows", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);
  const tokenB = tokenFor(businessBId, userBId, ownerRoleBId);

  const createGroupResponse = await apiJson("/v1/menu/modifier-groups", "POST", tokenA, {
    localizedNames: { fr: "Garnitures au choix" },
    type: "multi_select",
    required: false,
    minSelect: 0,
    maxSelect: 4,
    freeQuantity: 2,
    extraPrice: "10.00",
    attachScope: "product",
    reusable: true,
    values: [
      {
        name: "Olives",
        localizedNames: { fr: "Olives" },
        priceAddition: "0.00",
        position: 0,
        available: true,
        recipeHookKey: "olives",
      },
      {
        name: "Fromage",
        localizedNames: { fr: "Fromage" },
        priceAddition: "5.00",
        position: 1,
        available: true,
        recipeHookKey: null,
      },
    ],
  });
  const createGroupBody = (await createGroupResponse.json()) as {
    group: { id: string; values: Array<{ id: string; recipeHookKey: string | null }> };
  };
  assert.equal(createGroupResponse.status, 201, JSON.stringify(createGroupBody));
  assert.equal(createGroupBody.group.values[0]?.recipeHookKey, "olives");

  const attachResponse = await apiJson(
    `/v1/menu/products/${productAId}/modifier-groups`,
    "PUT",
    tokenA,
    { groupTemplateIds: [createGroupBody.group.id] },
  );
  const attachBody = (await attachResponse.json()) as {
    groups: Array<{ templateId: string; source: string; freeQuantity: number; extraPrice: string }>;
  };
  assert.equal(attachResponse.status, 200, JSON.stringify(attachBody));
  const materializedGroup = attachBody.groups.find(
    (group) => group.templateId === createGroupBody.group.id,
  );
  assert.equal(materializedGroup?.source, "product");
  assert.equal(materializedGroup?.freeQuantity, 2);
  assert.equal(materializedGroup?.extraPrice, "10.00");

  const optionRows = await adminDb
    .select({ id: productOptions.id, templateId: productOptions.templateId })
    .from(productOptions)
    .where(eq(productOptions.productId, productAId));
  assert.equal(optionRows.length, 1);
  assert.equal(optionRows[0]?.templateId, createGroupBody.group.id);
  const valueRows = await adminDb
    .select({ templateValueId: optionValues.templateValueId })
    .from(optionValues)
    .where(eq(optionValues.optionId, optionRows[0]!.id));
  assert.equal(valueRows.length, 2);

  const forbiddenAttach = await apiJson(
    `/v1/menu/products/${productBId}/modifier-groups`,
    "PUT",
    tokenA,
    { groupTemplateIds: [createGroupBody.group.id] },
  );
  assert.equal(forbiddenAttach.status, 404, await forbiddenAttach.text());

  const forbiddenGroupUse = await apiJson(
    `/v1/menu/products/${productBId}/modifier-groups`,
    "PUT",
    tokenB,
    { groupTemplateIds: [createGroupBody.group.id] },
  );
  assert.equal(forbiddenGroupUse.status, 404, await forbiddenGroupUse.text());

  const productDetail = await apiGet(`/v1/menu/products/${productAId}`, tokenA);
  const productDetailBody = (await productDetail.json()) as {
    product: { modifiers: Array<{ name: string; source: string; values: Array<{ name: string }> }> };
  };
  assert.equal(productDetail.status, 200, JSON.stringify(productDetailBody));
  assert.equal(productDetailBody.product.modifiers[0]?.name, "Garnitures au choix");
  assert.equal(productDetailBody.product.modifiers[0]?.values.length, 2);
  assert.ok(
    productDetailBody.product.modifiers.every((group) =>
      group.values.every((value) => value.name !== "Tenant B Secret Sauce"),
    ),
  );
});

test("M3.6 re-applying a modifier template updates materialized values in place", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);
  const createGroupResponse = await apiJson("/v1/menu/modifier-groups", "POST", tokenA, {
    localizedNames: { fr: "Sauce reapply" },
    type: "multi_select",
    required: false,
    minSelect: 0,
    maxSelect: 3,
    freeQuantity: 1,
    extraPrice: "5.00",
    attachScope: "product",
    reusable: true,
    values: [
      {
        name: "Harissa",
        localizedNames: { fr: "Harissa" },
        priceAddition: "0.00",
        position: 0,
        available: true,
        recipeHookKey: "harissa",
      },
      {
        name: "Aioli",
        localizedNames: { fr: "Aioli" },
        priceAddition: "2.00",
        position: 1,
        available: true,
        recipeHookKey: null,
      },
    ],
  });
  const createGroupBody = (await createGroupResponse.json()) as {
    group: { id: string; values: Array<{ id: string; name: string }> };
  };
  assert.equal(createGroupResponse.status, 201, JSON.stringify(createGroupBody));

  const attachResponse = await apiJson(
    `/v1/menu/products/${productAId}/modifier-groups`,
    "PUT",
    tokenA,
    { groupTemplateIds: [createGroupBody.group.id] },
  );
  assert.equal(attachResponse.status, 200, await attachResponse.text());

  const [optionRow] = await adminDb
    .select({ id: productOptions.id })
    .from(productOptions)
    .where(eq(productOptions.templateId, createGroupBody.group.id));
  assert.ok(optionRow);
  const beforeValues = await adminDb
    .select({
      id: optionValues.id,
      templateValueId: optionValues.templateValueId,
      name: optionValues.name,
    })
    .from(optionValues)
    .where(eq(optionValues.optionId, optionRow.id));
  assert.equal(beforeValues.length, 2);
  const harissaBefore = beforeValues.find((value) => value.name === "Harissa");
  const aioliBefore = beforeValues.find((value) => value.name === "Aioli");
  assert.ok(harissaBefore);
  assert.ok(aioliBefore);

  await databaseService.withTenant(businessAId, (tx) =>
    tx.insert(branchOptionValueOverrides).values({
      businessId: businessAId,
      branchId: branchAId,
      optionValueId: harissaBefore.id,
      available: false,
      priceAddition: "1.00",
    }),
  );

  const updateResponse = await apiJson(
    `/v1/menu/modifier-groups/${createGroupBody.group.id}`,
    "PATCH",
    tokenA,
    {
      localizedNames: { fr: "Sauce reapply updated" },
      values: [
        {
          id: harissaBefore.templateValueId,
          name: "Harissa forte",
          localizedNames: { fr: "Harissa forte" },
          priceAddition: "3.00",
          position: 0,
          available: true,
          recipeHookKey: "harissa",
        },
        {
          name: "Mayo",
          localizedNames: { fr: "Mayo" },
          priceAddition: "1.00",
          position: 1,
          available: true,
          recipeHookKey: null,
        },
      ],
    },
  );
  assert.equal(updateResponse.status, 200, await updateResponse.text());

  const reapplyResponse = await apiJson(
    `/v1/menu/modifier-groups/${createGroupBody.group.id}/reapply`,
    "POST",
    tokenA,
    {},
  );
  assert.equal(reapplyResponse.status, 201, await reapplyResponse.text());

  const afterValues = await adminDb
    .select({
      id: optionValues.id,
      templateValueId: optionValues.templateValueId,
      name: optionValues.name,
      priceAddition: optionValues.priceAddition,
    })
    .from(optionValues)
    .where(eq(optionValues.optionId, optionRow.id));
  assert.equal(afterValues.length, 2);
  const harissaAfter = afterValues.find((value) => value.templateValueId === harissaBefore.templateValueId);
  assert.ok(harissaAfter);
  assert.equal(harissaAfter.id, harissaBefore.id);
  assert.equal(harissaAfter.name, "Harissa forte");
  assert.equal(harissaAfter.priceAddition, "3.00");
  assert.equal(afterValues.some((value) => value.id === aioliBefore.id), false);
  assert.ok(afterValues.some((value) => value.name === "Mayo"));

  const overrideRows = await databaseService.withTenant(businessAId, (tx) =>
    tx
      .select()
      .from(branchOptionValueOverrides)
      .where(eq(branchOptionValueOverrides.optionValueId, harissaBefore.id)),
  );
  assert.equal(overrideRows.length, 1);
  assert.equal(overrideRows[0]?.available, false);
});

test("menu modifier API exposes category-wide inherited groups on product detail", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);
  const createGroupResponse = await apiJson("/v1/menu/modifier-groups", "POST", tokenA, {
    localizedNames: { fr: "Sauce au choix" },
    type: "single_select",
    required: true,
    minSelect: 1,
    maxSelect: 1,
    freeQuantity: 0,
    extraPrice: null,
    attachScope: "category",
    reusable: true,
    values: [
      {
        name: "Harissa",
        localizedNames: { fr: "Harissa" },
        priceAddition: "0.00",
        position: 0,
        available: true,
        recipeHookKey: null,
      },
    ],
  });
  const createGroupBody = (await createGroupResponse.json()) as { group: { id: string } };
  assert.equal(createGroupResponse.status, 201, JSON.stringify(createGroupBody));

  const attachResponse = await apiJson(
    `/v1/menu/categories/${categoryAId}/modifier-groups`,
    "PUT",
    tokenA,
    { groupTemplateIds: [createGroupBody.group.id] },
  );
  assert.equal(attachResponse.status, 200, await attachResponse.text());

  const productDetail = await apiGet(`/v1/menu/products/${productAId}`, tokenA);
  const productDetailBody = (await productDetail.json()) as {
    product: {
      modifiers: Array<{
        templateId: string | null;
        source: string;
        sourceCategoryId: string | null;
        sourceCategoryName: string | null;
      }>;
    };
  };
  assert.equal(productDetail.status, 200, JSON.stringify(productDetailBody));
  const inherited = productDetailBody.product.modifiers.find(
    (group) => group.templateId === createGroupBody.group.id,
  );
  assert.equal(inherited?.source, "category");
  assert.equal(inherited?.sourceCategoryId, categoryAId);
  assert.equal(inherited?.sourceCategoryName, "Tenant A Grillades");
});

test("menu category API enforces one-level subcategory depth", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);
  const childResponse = await apiJson("/v1/menu/categories", "POST", tokenA, {
    parentId: categoryAId,
    localizedNames: { fr: "Brochettes" },
    slug: `brochettes-${randomUUID().slice(0, 8)}`,
    position: 1,
  });
  const childBody = (await childResponse.json()) as { id: string };
  assert.equal(childResponse.status, 201, JSON.stringify(childBody));

  const grandchildResponse = await apiJson("/v1/menu/categories", "POST", tokenA, {
    parentId: childBody.id,
    localizedNames: { fr: "Poulet" },
    slug: `poulet-${randomUUID().slice(0, 8)}`,
    position: 0,
  });
  const body = await grandchildResponse.json();
  assert.equal(grandchildResponse.status, 400, JSON.stringify(body));
  assert.match(JSON.stringify(body), /category-depth-exceeded/);
});

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
