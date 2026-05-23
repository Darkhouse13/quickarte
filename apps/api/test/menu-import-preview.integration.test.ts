import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  auditLog,
  businesses,
  branches,
  categories,
  menuImportJobs,
  permissionVersions,
  permissions,
  products,
  productTags,
  productVariants,
  rolePermissions,
  roles,
  taxRates,
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
let branchAId: string;
let existingCategoryId: string;
let existingProductId: string;
let existingVariantId: string;

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
    { id: userAId, name: "Importer A", email: `import-a-${runId}@example.test`, role: "owner" },
    { id: userBId, name: "Importer B", email: `import-b-${runId}@example.test`, role: "owner" },
  ]);
  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: userAId,
      name: "Import Tenant A",
      slug: `import-a-${runId}`,
      type: "restaurant",
    },
    {
      id: businessBId,
      ownerId: userBId,
      name: "Import Tenant B",
      slug: `import-b-${runId}`,
      type: "restaurant",
    },
  ]);
  const [branchA, branchB] = await adminDb
    .insert(branches)
    .values([
      {
        businessId: businessAId,
        name: "Main A",
        slug: `main-a-${runId}`,
        isDefault: true,
      },
      {
        businessId: businessBId,
        name: "Main B",
        slug: `main-b-${runId}`,
        isDefault: true,
      },
    ])
    .returning({ id: branches.id });
  assert.ok(branchA);
  assert.ok(branchB);
  branchAId = branchA.id;
  await seedRolesAndPermissions(businessAId);
  await seedRolesAndPermissions(businessBId);

  const [category] = await adminDb
    .insert(categories)
    .values({
      businessId: businessAId,
      name: "Sandwichs",
      slug: `sandwichs-${runId}`,
      localizedNames: { fr: "Sandwichs" },
      position: 0,
    })
    .returning({ id: categories.id });
  assert.ok(category);
  existingCategoryId = category.id;

  const [product] = await adminDb
    .insert(products)
    .values({
      businessId: businessAId,
      categoryId: existingCategoryId,
      name: "Tacos",
      sku: `TACOS-${runId}`,
      itemCode: `T-${runId.slice(0, 6)}`,
      price: "75.00",
      localizedNames: { fr: "Tacos" },
      position: 0,
    })
    .returning({ id: products.id });
  assert.ok(product);
  existingProductId = product.id;

  const [variant] = await adminDb
    .insert(productVariants)
    .values({
      productId: existingProductId,
      name: "Poulet",
      priceOverride: "75.00",
      variantKind: "protein",
      pricingMode: "fixed",
      position: 0,
      isDefault: true,
    })
    .returning({ id: productVariants.id });
  assert.ok(variant);
  existingVariantId = variant.id;

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

test("M3.5b upload preview validates a flat variant sheet and persists a pending job", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  await ensureSystemTags(token);

  const csv = csvFromRows([
    {
      category_fr: "Sandwichs",
      product_fr: "Tacos",
      product_ar: "تاكوس",
      variant_name: "Poulet",
      variant_kind: "protein",
      price: "80,00",
      sku: `TACOS-${token.slice(0, 8)}`,
      item_code: "TAC-001",
      tax_rate_code: "ma_tva_10",
      tag_codes: "vegetarian",
      featured: "true",
      hidden: "false",
      available_dine_in: "true",
      available_takeaway: "true",
      available_delivery: "false",
      available_qr: "true",
      available_online: "false",
      spice_level: "2",
    },
    {
      category_fr: "Sandwichs",
      product_fr: "Tacos",
      variant_name: "Viande",
      variant_kind: "protein",
      price: "95.00",
      sku: `TACOS-${token.slice(0, 8)}`,
      tax_rate_code: "ma_tva_10",
      tag_codes: "vegetarian",
    },
    {
      category_fr: "Boissons",
      product_fr: "Eau 50cl",
      variant_name: "",
      variant_kind: "size",
      price: "10.00",
      sku: "",
      tax_rate_code: "ma_tva_20",
      tag_codes: "",
    },
  ]).replaceAll(`TACOS-${token.slice(0, 8)}`, await existingSku());

  const response = await uploadCsv(token, csv, "menu-valid.csv");
  const body = (await response.json()) as ImportPreviewResponse;
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.preview.summary.rowCount, 3);
  assert.equal(body.preview.summary.errorCount, 0);
  assert.equal(body.preview.summary.blockingErrors, false);
  assert.deepEqual(
    body.preview.rows.map((row) => row.action),
    ["update", "create", "create"],
  );
  assert.equal(body.preview.rows[0]?.normalized.price, "80.00");
  assert.equal(body.preview.rows[0]?.resolvedProduct?.id, existingProductId);
  assert.equal(body.preview.rows[0]?.resolvedVariant?.id, existingVariantId);
  assert.equal(body.preview.rows[1]?.resolvedProduct?.id, existingProductId);
  assert.equal(body.preview.rows[2]?.resolvedCategory?.name, "Boissons");

  const [job] = await databaseService.withTenant(businessAId, (tx) =>
    tx.select().from(menuImportJobs).where(eq(menuImportJobs.id, body.jobId)),
  );
  assert.ok(job);
  assert.equal(job.status, "pending_review");
  assert.equal(job.rowCount, 3);
  assert.equal(job.errorCount, 0);
});

test("M3.5b upload preview reports blocking row errors without writing catalog data", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  await ensureSystemTags(token);
  const beforeProducts = await adminDb
    .select({ id: products.id })
    .from(products)
    .where(eq(products.businessId, businessAId));

  const csv = csvFromRows([
    {
      category_fr: "",
      product_fr: "Missing category",
      price: "30.00",
      tax_rate_code: "ma_tva_10",
      tag_codes: "",
    },
    {
      category_fr: "Tajines",
      product_fr: "Bad price",
      price: "-10.00",
      tax_rate_code: "ma_tva_10",
      tag_codes: "",
    },
    {
      category_fr: "Tajines",
      product_fr: "Bad tax",
      price: "45.00",
      tax_rate_code: "unknown_tax",
      tag_codes: "",
    },
    {
      category_fr: "Tajines",
      product_fr: "Unknown tag",
      price: "45.00",
      tax_rate_code: "ma_tva_10",
      tag_codes: "vegetarian,ghost_tag",
    },
  ]);

  const response = await uploadCsv(token, csv, "menu-errors.csv");
  const body = (await response.json()) as ImportPreviewResponse;
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.preview.summary.blockingErrors, true);
  assert.equal(body.preview.summary.errorCount, 4);
  assert.deepEqual(
    body.preview.rows.flatMap((row) => row.errors.map((error) => error.code)),
    [
      "required-category-fr",
      "invalid-price",
      "unknown-tax-rate",
      "unknown-tag-code",
    ],
  );
  assert.ok(body.preview.rows.every((row) => row.action === "skip"));

  const afterProducts = await adminDb
    .select({ id: products.id })
    .from(products)
    .where(eq(products.businessId, businessAId));
  assert.equal(afterProducts.length, beforeProducts.length);
});

test("M3.5b tenant cannot fetch another tenant's import job", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);
  const tokenB = tokenFor(businessBId, userBId, ownerRoleBId);
  const upload = await uploadCsv(
    tokenA,
    csvFromRows([
      {
        category_fr: "Desserts",
        product_fr: "Orange cannelle",
        price: "22.00",
        tax_rate_code: "ma_tva_10",
      },
    ]),
    "tenant-a.csv",
  );
  const uploadBody = (await upload.json()) as ImportPreviewResponse;
  assert.equal(upload.status, 201, JSON.stringify(uploadBody));

  const ownResponse = await apiGet(`/v1/menu/import/${uploadBody.jobId}`, tokenA);
  assert.equal(ownResponse.status, 200, await ownResponse.text());

  const forgedResponse = await apiGet(`/v1/menu/import/${uploadBody.jobId}`, tokenB);
  assert.equal(forgedResponse.status, 404, await forgedResponse.text());
});

test("M3.5b menu_import_jobs RLS isolates stored previews", async (t) => {
  const jobAId = randomUUID();
  await databaseService.withTenant(businessAId, (tx) =>
    tx.insert(menuImportJobs).values({
      id: jobAId,
      businessId: businessAId,
      status: "pending_review",
      originalFilename: "rls.csv",
      fileType: "csv",
      parsedRows: [],
      previewReport: { rows: [], summary: { rowCount: 0 } },
      rowCount: 0,
      errorCount: 0,
      warningCount: 0,
      createdBy: userAId,
    }),
  );

  await t.test("tenant A reads its own import jobs", async () => {
    const rows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(menuImportJobs).where(eq(menuImportJobs.id, jobAId)),
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.businessId, businessAId);
  });

  await t.test("tenant B forged predicate cannot read tenant A import jobs", async () => {
    const rows = await databaseService.withTenant(businessBId, (tx) =>
      tx.select().from(menuImportJobs).where(eq(menuImportJobs.businessId, businessAId)),
    );
    assert.equal(rows.length, 0);
  });

  await t.test("direct app-role query without tenant context reads zero import jobs", async () => {
    assert.equal((await appDb.select().from(menuImportJobs)).length, 0);
  });

  await t.test("tenant A cannot insert tenant B import job", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(menuImportJobs).values({
          id: randomUUID(),
          businessId: businessBId,
          status: "pending_review",
          originalFilename: "forged.csv",
          fileType: "csv",
          parsedRows: [],
          previewReport: { rows: [], summary: { rowCount: 0 } },
          rowCount: 0,
          errorCount: 0,
          warningCount: 0,
          createdBy: userAId,
        }),
      ),
      (error) =>
        /row-level security policy|violates row-level security/i.test(String(error)) ||
        (error instanceof Error &&
          "cause" in error &&
          /row-level security policy|violates row-level security/i.test(
            String(error.cause),
          )),
    );
  });
});

test("M3.5b template endpoint returns an xlsx workbook", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const response = await apiGet("/v1/menu/import/template", token);
  const buffer = await response.arrayBuffer();
  assert.equal(response.status, 200, Buffer.from(buffer).toString("utf8"));
  assert.match(response.headers.get("content-type") ?? "", /spreadsheetml|octet-stream/);
  const bytes = new Uint8Array(buffer);
  assert.equal(String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0), "PK");
});

test("M3.5b commit applies grouped rows atomically and effective menu reflects imported variants", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  await ensureSystemTags(token);
  const sku = `GRILL-${randomUUID()}`;
  const csv = csvFromRows([
    {
      category_fr: "Grillades import",
      product_fr: "Brochette mixte",
      description_fr: "Servie avec garniture",
      sku,
      item_code: "BR-MIX",
      variant_name: "Poulet",
      variant_kind: "protein",
      price: "80,00",
      tax_rate_code: "ma_tva_10",
      tag_codes: "halal",
      available_delivery: "false",
      spice_level: "1",
    },
    {
      category_fr: "Grillades import",
      product_fr: "Brochette mixte",
      sku,
      item_code: "BR-MIX",
      variant_name: "Viande",
      variant_kind: "protein",
      price: "95.00",
      tax_rate_code: "ma_tva_10",
      tag_codes: "halal",
      available_delivery: "false",
      spice_level: "1",
    },
  ]);
  const uploadBody = await uploadAndParse(token, csv, "commit-happy.csv");

  const commitResponse = await apiPost(`/v1/menu/import/${uploadBody.jobId}/commit`, token);
  const commitBody = (await commitResponse.json()) as ImportCommitResponse;
  assert.equal(commitResponse.status, 201, JSON.stringify(commitBody));
  assert.deepEqual(commitBody.counts, {
    categoriesCreated: 1,
    categoriesUpdated: 0,
    productsCreated: 1,
    productsUpdated: 0,
    variantsCreated: 2,
    variantsUpdated: 0,
    tagsAttached: 1,
  });

  const categoryRows = await adminDb
    .select()
    .from(categories)
    .where(and(eq(categories.businessId, businessAId), eq(categories.name, "Grillades import")));
  assert.equal(categoryRows.length, 1);
  const productRows = await adminDb
    .select()
    .from(products)
    .where(and(eq(products.businessId, businessAId), eq(products.sku, sku)));
  assert.equal(productRows.length, 1);
  assert.equal(productRows[0]?.categoryId, categoryRows[0]?.id);
  assert.equal(productRows[0]?.price, "80.00");
  const variantRows = await adminDb
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productRows[0]!.id));
  assert.equal(variantRows.length, 2);
  assert.deepEqual(
    variantRows.map((row) => `${row.name}:${row.priceOverride}`).sort(),
    ["Poulet:80.00", "Viande:95.00"],
  );
  const tagRows = await adminDb
    .select()
    .from(productTags)
    .where(eq(productTags.productId, productRows[0]!.id));
  assert.equal(tagRows.length, 1);

  const effectiveResponse = await apiGet(
    `/v1/branches/${branchAId}/menu/effective?channel=pos`,
    token,
  );
  const effectiveBody = (await effectiveResponse.json()) as {
    categories: Array<{ products: Array<{ id: string; variants: Array<{ name: string; price: string }> }> }>;
  };
  assert.equal(effectiveResponse.status, 200, JSON.stringify(effectiveBody));
  const effectiveProduct = effectiveBody.categories
    .flatMap((category) => category.products)
    .find((product) => product.id === productRows[0]!.id);
  assert.ok(effectiveProduct);
  assert.deepEqual(
    effectiveProduct.variants.map((variant) => `${variant.name}:${variant.price}`).sort(),
    ["Poulet:80.00", "Viande:95.00"],
  );

  const [audit] = await databaseService.withTenant(businessAId, (tx) =>
    tx
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.businessId, businessAId), eq(auditLog.action, "menu.import.committed"))),
  );
  assert.ok(audit);
  assert.equal(audit.entityId, uploadBody.jobId);
});

test("M3.5b re-importing the same sheet updates without duplicating category, product, or variants", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const sku = `IDEMP-${randomUUID()}`;
  const csv = csvFromRows([
    {
      category_fr: "Idempotent import",
      product_fr: "Tajine kefta",
      sku,
      variant_name: "Standard",
      variant_kind: "custom",
      price: "70.00",
      tax_rate_code: "ma_tva_10",
    },
    {
      category_fr: "Idempotent import",
      product_fr: "Tajine kefta",
      sku,
      variant_name: "Royal",
      variant_kind: "custom",
      price: "90.00",
      tax_rate_code: "ma_tva_10",
    },
  ]);

  const firstUpload = await uploadAndParse(token, csv, "idempotent-1.csv");
  const firstCommit = await apiPost(`/v1/menu/import/${firstUpload.jobId}/commit`, token);
  assert.equal(firstCommit.status, 201, await firstCommit.text());

  const secondUpload = await uploadAndParse(token, csv.replace("90.00", "92.00"), "idempotent-2.csv");
  const secondCommit = await apiPost(`/v1/menu/import/${secondUpload.jobId}/commit`, token);
  const secondBody = (await secondCommit.json()) as ImportCommitResponse;
  assert.equal(secondCommit.status, 201, JSON.stringify(secondBody));
  assert.deepEqual(secondBody.counts, {
    categoriesCreated: 0,
    categoriesUpdated: 1,
    productsCreated: 0,
    productsUpdated: 1,
    variantsCreated: 0,
    variantsUpdated: 2,
    tagsAttached: 0,
  });

  const categoryRows = await adminDb
    .select()
    .from(categories)
    .where(and(eq(categories.businessId, businessAId), eq(categories.name, "Idempotent import")));
  assert.equal(categoryRows.length, 1);
  const productRows = await adminDb
    .select()
    .from(products)
    .where(and(eq(products.businessId, businessAId), eq(products.sku, sku)));
  assert.equal(productRows.length, 1);
  const variantRows = await adminDb
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productRows[0]!.id));
  assert.equal(variantRows.length, 2);
  assert.equal(variantRows.find((row) => row.name === "Royal")?.priceOverride, "92.00");
});

test("M3.5b commit refuses jobs with blocking errors and leaves the job pending", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const beforeProducts = await adminDb
    .select({ id: products.id })
    .from(products)
    .where(eq(products.businessId, businessAId));
  const uploadBody = await uploadAndParse(
    token,
    csvFromRows([
      {
        category_fr: "Errors",
        product_fr: "Bad price",
        price: "-10.00",
        tax_rate_code: "ma_tva_10",
      },
    ]),
    "blocking-errors.csv",
  );

  const commitResponse = await apiPost(`/v1/menu/import/${uploadBody.jobId}/commit`, token);
  const commitBody = (await commitResponse.json()) as { preview: { summary: { blockingErrors: boolean } } };
  assert.equal(commitResponse.status, 400, JSON.stringify(commitBody));
  assert.equal(commitBody.preview.summary.blockingErrors, true);
  const [job] = await databaseService.withTenant(businessAId, (tx) =>
    tx.select().from(menuImportJobs).where(eq(menuImportJobs.id, uploadBody.jobId)),
  );
  assert.equal(job?.status, "pending_review");
  const afterProducts = await adminDb
    .select({ id: products.id })
    .from(products)
    .where(eq(products.businessId, businessAId));
  assert.equal(afterProducts.length, beforeProducts.length);
});

test("M3.5b commit revalidates stale tax references and rolls back the whole import", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const sku = `STALE-${randomUUID()}`;
  const uploadBody = await uploadAndParse(
    token,
    csvFromRows([
      {
        category_fr: "Stale tax",
        product_fr: "Pastilla",
        sku,
        price: "120.00",
        tax_rate_code: "ma_tva_7",
      },
    ]),
    "stale-tax.csv",
  );
  await adminDb.update(taxRates).set({ isActive: false }).where(eq(taxRates.id, "ma_tva_7"));
  try {
    const commitResponse = await apiPost(`/v1/menu/import/${uploadBody.jobId}/commit`, token);
    const commitBody = (await commitResponse.json()) as { preview: { rows: Array<{ errors: Array<{ code: string }> }> } };
    assert.equal(commitResponse.status, 400, JSON.stringify(commitBody));
    assert.ok(
      commitBody.preview.rows.some((row) =>
        row.errors.some((error) => error.code === "unknown-tax-rate"),
      ),
    );
    const productRows = await adminDb
      .select()
      .from(products)
      .where(and(eq(products.businessId, businessAId), eq(products.sku, sku)));
    assert.equal(productRows.length, 0);
  } finally {
    await adminDb.update(taxRates).set({ isActive: true }).where(eq(taxRates.id, "ma_tva_7"));
  }
});

test("M3.6 import disambiguates accent-colliding category slugs", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const uploadBody = await uploadAndParse(
    token,
    csvFromRows([
      {
        category_fr: "Cafe Atlas",
        product_fr: "Produit A",
        sku: `ATOMIC-A-${randomUUID()}`,
        price: "40.00",
        tax_rate_code: "ma_tva_10",
      },
      {
        category_fr: "Café Atlas",
        product_fr: "Produit B",
        sku: `ATOMIC-B-${randomUUID()}`,
        price: "45.00",
        tax_rate_code: "ma_tva_10",
      },
    ]),
    "slug-collision.csv",
  );

  const commitResponse = await apiPost(`/v1/menu/import/${uploadBody.jobId}/commit`, token);
  assert.equal(commitResponse.status, 201, await commitResponse.text());
  const productRows = await adminDb
    .select()
    .from(products)
    .where(and(eq(products.businessId, businessAId), eq(products.name, "Produit A")));
  assert.equal(productRows.length, 1);
  const categoryRows = await adminDb
    .select()
    .from(categories)
    .where(and(eq(categories.businessId, businessAId), eq(categories.slug, "cafe-atlas")));
  assert.equal(categoryRows.length, 1);
  const importedCategories = await adminDb
    .select({ name: categories.name, slug: categories.slug })
    .from(categories)
    .where(and(eq(categories.businessId, businessAId), sql`${categories.slug} like 'cafe-atlas%'`));
  const slugs = importedCategories
    .map((row) => row.slug)
    .sort();
  assert.deepEqual(slugs, ["cafe-atlas", "cafe-atlas-2"]);
});

test("M3.6 commit rolls back partial catalog writes when applyRows fails mid-transaction", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const runId = randomUUID();
  const firstCategory = `Atomic rollback first ${runId}`;
  const secondCategory = `Atomic rollback second ${runId}`;
  const firstSku = `ROLLBACK-A-${runId}`;
  const secondSku = `ROLLBACK-B-${runId}`;

  await adminDb.execute(sql`
    CREATE OR REPLACE FUNCTION m3_6_force_variant_failure()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.name = '__FORCE_FAIL__' THEN
        RAISE EXCEPTION 'forced variant insert failure';
      END IF;
      RETURN NEW;
    END;
    $$;
  `);
  await adminDb.execute(sql`DROP TRIGGER IF EXISTS m3_6_force_variant_failure ON product_variants`);
  await adminDb.execute(sql`
    CREATE TRIGGER m3_6_force_variant_failure
    BEFORE INSERT ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION m3_6_force_variant_failure();
  `);

  try {
    const uploadBody = await uploadAndParse(
      token,
      csvFromRows([
        {
          category_fr: firstCategory,
          product_fr: "Should roll back",
          sku: firstSku,
          variant_name: "Standard",
          price: "40.00",
          tax_rate_code: "ma_tva_10",
        },
        {
          category_fr: secondCategory,
          product_fr: "Forces DB failure",
          sku: secondSku,
          variant_name: "__FORCE_FAIL__",
          price: "45.00",
          tax_rate_code: "ma_tva_10",
        },
      ]),
      "atomic-rollback.csv",
    );

    const commitResponse = await apiPost(`/v1/menu/import/${uploadBody.jobId}/commit`, token);
    assert.equal(commitResponse.status, 500, await commitResponse.text());

    const categoryRows = await adminDb
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.businessId, businessAId),
          sql`${categories.name} in (${firstCategory}, ${secondCategory})`,
        ),
      );
    assert.equal(categoryRows.length, 0);

    const productRows = await adminDb
      .select()
      .from(products)
      .where(
        and(
          eq(products.businessId, businessAId),
          sql`${products.sku} in (${firstSku}, ${secondSku})`,
        ),
      );
    assert.equal(productRows.length, 0);

    const variantRows = await adminDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.name, "__FORCE_FAIL__"));
    assert.equal(variantRows.length, 0);

    const [job] = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(menuImportJobs).where(eq(menuImportJobs.id, uploadBody.jobId)),
    );
    assert.equal(job?.status, "pending_review");
  } finally {
    await adminDb.execute(sql`DROP TRIGGER IF EXISTS m3_6_force_variant_failure ON product_variants`);
    await adminDb.execute(sql`DROP FUNCTION IF EXISTS m3_6_force_variant_failure()`);
  }
});

test("M3.5b commit rejects already committed jobs", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const uploadBody = await uploadAndParse(
    token,
    csvFromRows([
      {
        category_fr: "Already committed",
        product_fr: "The a la menthe",
        sku: `DONE-${randomUUID()}`,
        price: "15.00",
        tax_rate_code: "ma_tva_10",
      },
    ]),
    "already-committed.csv",
  );
  const firstCommit = await apiPost(`/v1/menu/import/${uploadBody.jobId}/commit`, token);
  assert.equal(firstCommit.status, 201, await firstCommit.text());
  const secondCommit = await apiPost(`/v1/menu/import/${uploadBody.jobId}/commit`, token);
  assert.equal(secondCommit.status, 409, await secondCommit.text());
});

test("M3.5b commit rejects another tenant's job", async () => {
  const tokenA = tokenFor(businessAId, userAId, ownerRoleAId);
  const tokenB = tokenFor(businessBId, userBId, ownerRoleBId);
  const uploadBody = await uploadAndParse(
    tokenA,
    csvFromRows([
      {
        category_fr: "Tenant A only",
        product_fr: "Harira",
        sku: `TENANT-A-${randomUUID()}`,
        price: "25.00",
        tax_rate_code: "ma_tva_10",
      },
    ]),
    "tenant-a-commit.csv",
  );

  const forgedCommit = await apiPost(`/v1/menu/import/${uploadBody.jobId}/commit`, tokenB);
  assert.equal(forgedCommit.status, 404, await forgedCommit.text());
});

async function existingSku(): Promise<string> {
  const [row] = await adminDb
    .select({ sku: products.sku })
    .from(products)
    .where(eq(products.id, existingProductId));
  assert.ok(row?.sku);
  return row.sku;
}

async function ensureSystemTags(token: string): Promise<void> {
  const response = await apiGet("/v1/menu/tags", token);
  const text = await response.text();
  assert.equal(response.status, 200, text);
  const body = JSON.parse(text) as { tags: Array<{ code: string }> };
  assert.ok(body.tags.some((tag) => tag.code === "vegetarian"));
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

async function uploadCsv(token: string, csv: string, filename: string): Promise<Response> {
  const form = new FormData();
  form.set("file", new Blob([csv], { type: "text/csv" }), filename);
  return fetch(`${baseUrl}/v1/menu/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

async function uploadAndParse(
  token: string,
  csv: string,
  filename: string,
): Promise<ImportPreviewResponse> {
  const response = await uploadCsv(token, csv, filename);
  const body = (await response.json()) as ImportPreviewResponse;
  assert.equal(response.status, 201, JSON.stringify(body));
  return body;
}

async function apiPost(path: string, token: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

function csvFromRows(rows: Array<Record<string, string>>): string {
  const headers = [
    "category_fr",
    "category_ar",
    "category_en",
    "category_es",
    "product_fr",
    "product_ar",
    "product_en",
    "product_es",
    "description_fr",
    "description_ar",
    "description_en",
    "description_es",
    "sku",
    "item_code",
    "variant_name",
    "variant_kind",
    "price",
    "tax_rate_code",
    "tag_codes",
    "color_tag",
    "featured",
    "hidden",
    "available_dine_in",
    "available_takeaway",
    "available_delivery",
    "available_qr",
    "available_online",
    "spice_level",
  ];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")),
  ].join("\n");
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

async function seedRolesAndPermissions(businessId: string): Promise<void> {
  const [owner] = await adminDb
    .insert(roles)
    .values({
      businessId,
      name: "Owner",
      isSystem: true,
    })
    .returning({ id: roles.id });
  assert.ok(owner);
  if (businessId === businessAId) ownerRoleAId = owner.id;
  if (businessId === businessBId) ownerRoleBId = owner.id;

  await adminDb
    .insert(permissions)
    .values([
      { id: "menu.view", description: "View menu catalog", category: "menu" },
      { id: "menu.manage", description: "Manage menu catalog", category: "menu" },
    ])
    .onConflictDoNothing();
  await adminDb
    .insert(rolePermissions)
    .values([
      { roleId: owner.id, permissionId: "menu.view" },
      { roleId: owner.id, permissionId: "menu.manage" },
    ])
    .onConflictDoNothing();
  await adminDb
    .insert(permissionVersions)
    .values({ businessId, version: 1 })
    .onConflictDoNothing();
}

type ImportPreviewResponse = {
  jobId: string;
  preview: {
    rows: Array<{
      rowNumber: number;
      action: "create" | "update" | "skip";
      normalized: { price: string };
      resolvedCategory: { id: string | null; name: string } | null;
      resolvedProduct: { id: string | null; name: string } | null;
      resolvedVariant: { id: string | null; name: string } | null;
      errors: Array<{ code: string; message: string }>;
      warnings: Array<{ code: string; message: string }>;
    }>;
    summary: {
      rowCount: number;
      createCount: number;
      updateCount: number;
      skipCount: number;
      errorCount: number;
      warningCount: number;
      blockingErrors: boolean;
    };
  };
};

type ImportCommitResponse = {
  jobId: string;
  status: "committed";
  counts: {
    categoriesCreated: number;
    categoriesUpdated: number;
    productsCreated: number;
    productsUpdated: number;
    variantsCreated: number;
    variantsUpdated: number;
    tagsAttached: number;
  };
};
