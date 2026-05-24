import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  businesses,
  dietaryTags,
  ingredientImportJobs,
  ingredients,
  ingredientTags,
  permissionVersions,
  permissions,
  rolePermissions,
  roles,
  users,
} from "@quickarte/db-schema";
import * as schema from "@quickarte/db-schema";
import { and, eq, ilike, sql } from "drizzle-orm";
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
let tagACode: string;

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
  tagACode = `contains_dairy_${runId.replace(/-/g, "_")}`;

  await adminDb.insert(users).values([
    { id: userAId, name: "Ingredient Import A", email: `ingredient-import-a-${runId}@example.test`, role: "owner" },
    { id: userBId, name: "Ingredient Import B", email: `ingredient-import-b-${runId}@example.test`, role: "owner" },
  ]);
  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: userAId,
      name: "Ingredient Import Tenant A",
      slug: `ingredient-import-a-${runId}`,
      type: "restaurant",
    },
    {
      id: businessBId,
      ownerId: userBId,
      name: "Ingredient Import Tenant B",
      slug: `ingredient-import-b-${runId}`,
      type: "restaurant",
    },
  ]);
  ownerRoleAId = await seedRolesAndPermissions(businessAId);
  await seedRolesAndPermissions(businessBId);
  await adminDb.insert(dietaryTags).values({
    id: tagAId,
    businessId: businessAId,
    kind: "allergen",
    code: tagACode,
    localizedLabels: { fr: "Contient lait" },
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

test("M4.4 ingredient import previews, commits, and re-imports without duplicates", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const csv = csvFromRows([
    {
      name_fr: "Oignon import",
      name_en: "Onion",
      category: "vegetable",
      stock_uom: "g",
      current_cost_per_uom: "8,50",
      tracked_in_stock: "true",
      storage_location: "Reserve",
      allergen_tag_codes: tagACode,
    },
  ]);

  const first = await uploadAndParse(token, csv, "ingredients.csv");
  assert.equal(first.preview.summary.blockingErrors, false);
  assert.equal(first.preview.rows[0]?.action, "create");
  assert.equal(first.preview.rows[0]?.normalized.currentCostPerUom, "8.50");

  const firstCommit = await apiPost(`/v1/ingredients/import/${first.jobId}/commit`, token);
  assert.equal(firstCommit.status, 201, await firstCommit.clone().text());
  const firstCommitBody = (await firstCommit.json()) as IngredientImportCommitResponse;
  assert.equal(firstCommitBody.counts.ingredientsCreated, 1);
  assert.equal(firstCommitBody.counts.tagsAttached, 1);

  const second = await uploadAndParse(token, csv, "ingredients-again.csv");
  assert.equal(second.preview.rows[0]?.action, "update");
  const secondCommit = await apiPost(`/v1/ingredients/import/${second.jobId}/commit`, token);
  assert.equal(secondCommit.status, 201, await secondCommit.clone().text());
  const secondCommitBody = (await secondCommit.json()) as IngredientImportCommitResponse;
  assert.equal(secondCommitBody.counts.ingredientsCreated, 0);
  assert.equal(secondCommitBody.counts.ingredientsUpdated, 1);

  const rows = await adminDb
    .select()
    .from(ingredients)
    .where(and(eq(ingredients.businessId, businessAId), eq(ingredients.name, "Oignon import")));
  assert.equal(rows.length, 1);
});

test("M4.4 ingredient import refuses blocking preview errors and keeps job pending", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const body = await uploadAndParse(
    token,
    csvFromRows([
      {
        name_fr: "Unknown allergen",
        category: "vegetable",
        stock_uom: "g",
        current_cost_per_uom: "5.00",
        allergen_tag_codes: "missing_tag_code",
      },
    ]),
    "bad-ingredients.csv",
  );

  assert.equal(body.preview.summary.blockingErrors, true);
  assert.equal(body.preview.rows[0]?.errors[0]?.code, "unknown-tag-code");

  const commit = await apiPost(`/v1/ingredients/import/${body.jobId}/commit`, token);
  assert.equal(commit.status, 400, await commit.clone().text());
  const [job] = await adminDb
    .select()
    .from(ingredientImportJobs)
    .where(eq(ingredientImportJobs.id, body.jobId));
  assert.equal(job?.status, "pending_review");
});

test("M4.4 ingredient import rolls back partial writes when commit fails mid-transaction", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const csv = csvFromRows([
    {
      name_fr: "Atomic ingredient before failure",
      category: "vegetable",
      stock_uom: "g",
      current_cost_per_uom: "1.00",
    },
    {
      name_fr: "__FORCE_INGREDIENT_FAIL__",
      category: "vegetable",
      stock_uom: "g",
      current_cost_per_uom: "2.00",
    },
  ]);
  const body = await uploadAndParse(token, csv, "atomic-ingredients.csv");

  await adminDb.execute(sql`
    CREATE OR REPLACE FUNCTION fail_ingredient_import_sentinel()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.name = '__FORCE_INGREDIENT_FAIL__' THEN
        RAISE EXCEPTION 'forced ingredient import failure';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  await adminDb.execute(sql`
    DROP TRIGGER IF EXISTS ingredients_force_import_fail ON ingredients;
    CREATE TRIGGER ingredients_force_import_fail
    BEFORE INSERT ON ingredients
    FOR EACH ROW EXECUTE FUNCTION fail_ingredient_import_sentinel();
  `);

  try {
    const commit = await apiPost(`/v1/ingredients/import/${body.jobId}/commit`, token);
    assert.equal(commit.status, 500, await commit.clone().text());
  } finally {
    await adminDb.execute(sql`DROP TRIGGER IF EXISTS ingredients_force_import_fail ON ingredients`);
    await adminDb.execute(sql`DROP FUNCTION IF EXISTS fail_ingredient_import_sentinel()`);
  }

  const rows = await adminDb
    .select()
    .from(ingredients)
    .where(and(eq(ingredients.businessId, businessAId), ilike(ingredients.name, "%Atomic ingredient%")));
  assert.equal(rows.length, 0);
  const [job] = await adminDb
    .select()
    .from(ingredientImportJobs)
    .where(eq(ingredientImportJobs.id, body.jobId));
  assert.equal(job?.status, "pending_review");
});

test("M4.4 ingredient_import_jobs RLS isolates stored previews", async (t) => {
  const jobAId = randomUUID();
  const jobBId = randomUUID();
  await adminDb.insert(ingredientImportJobs).values([
    {
      id: jobAId,
      businessId: businessAId,
      originalFilename: "a.csv",
      fileType: "csv",
      parsedRows: [],
      previewReport: {},
    },
    {
      id: jobBId,
      businessId: businessBId,
      originalFilename: "b.csv",
      fileType: "csv",
      parsedRows: [],
      previewReport: {},
    },
  ]);

  await t.test("tenant A reads only its ingredient import jobs", async () => {
    const rows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(ingredientImportJobs),
    );
    assert.ok(rows.some((row) => row.id === jobAId));
    assert.equal(rows.some((row) => row.id === jobBId), false);
  });

  await t.test("direct app-role query without tenant context reads zero ingredient import jobs", async () => {
    assert.equal((await appDb.select().from(ingredientImportJobs)).length, 0);
  });

  await t.test("tenant A cannot insert tenant B ingredient import job", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(ingredientImportJobs).values({
          businessId: businessBId,
          originalFilename: "forged.csv",
          fileType: "csv",
          parsedRows: [],
          previewReport: {},
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

async function uploadCsv(token: string, csv: string, filename: string): Promise<Response> {
  const form = new FormData();
  form.set("file", new Blob([csv], { type: "text/csv" }), filename);
  return fetch(`${baseUrl}/v1/ingredients/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

async function uploadAndParse(
  token: string,
  csv: string,
  filename: string,
): Promise<IngredientImportPreviewResponse> {
  const response = await uploadCsv(token, csv, filename);
  const body = (await response.json()) as IngredientImportPreviewResponse;
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
    "name_fr",
    "name_ar",
    "name_en",
    "name_es",
    "category",
    "stock_uom",
    "current_cost_per_uom",
    "tracked_in_stock",
    "storage_location",
    "allergen_tag_codes",
  ];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")),
  ].join("\n");
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

type IngredientImportPreviewResponse = {
  jobId: string;
  preview: {
    rows: Array<{
      action: "create" | "update" | "skip";
      normalized: {
        currentCostPerUom: string | null;
      };
      errors: Array<{ code: string; message: string }>;
    }>;
    summary: {
      blockingErrors: boolean;
    };
  };
};

type IngredientImportCommitResponse = {
  counts: {
    ingredientsCreated: number;
    ingredientsUpdated: number;
    tagsAttached: number;
  };
};
