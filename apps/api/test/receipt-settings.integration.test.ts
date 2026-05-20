import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  branchReceiptSettings,
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
    { id: userAId, name: "Receipt Owner A", email: `receipt-a-${runId}@example.test`, role: "owner" },
    { id: userBId, name: "Receipt Owner B", email: `receipt-b-${runId}@example.test`, role: "owner" },
  ]);
  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: userAId,
      name: "Receipt Tenant A",
      slug: `receipt-a-${runId}`,
      type: "restaurant",
    },
    {
      id: businessBId,
      ownerId: userBId,
      name: "Receipt Tenant B",
      slug: `receipt-b-${runId}`,
      type: "cafe",
    },
  ]);

  const [branchA] = await adminDb
    .insert(branches)
    .values({
      businessId: businessAId,
      name: "Receipt Branch A",
      slug: `receipt-main-a-${runId}`,
      isDefault: true,
    })
    .returning({ id: branches.id });
  const [branchB] = await adminDb
    .insert(branches)
    .values({
      businessId: businessBId,
      name: "Receipt Branch B",
      slug: `receipt-main-b-${runId}`,
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

test("M2.4 RLS isolates branch receipt settings", async (t) => {
  await databaseService.withTenant(businessAId, async (tx) => {
    await tx.insert(branchReceiptSettings).values({
      businessId: businessAId,
      branchId: branchAId,
      headerLines: [{ locale: "fr", text: "Bienvenue" }],
      footerLines: [{ locale: "fr", text: "Merci" }],
      paperWidth: "80mm",
      bilingualMode: "fr_only",
      qrCodeMode: "none",
    });
  });

  await t.test("tenant A can read only its own receipt settings", async () => {
    const rows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(branchReceiptSettings),
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.businessId, businessAId);
  });

  await t.test("tenant B forged predicates cannot read tenant A settings", async () => {
    const rows = await databaseService.withTenant(businessBId, (tx) =>
      tx
        .select()
        .from(branchReceiptSettings)
        .where(eq(branchReceiptSettings.businessId, businessAId)),
    );
    assert.equal(rows.length, 0);
  });

  await t.test("direct app-role query without tenant context reads zero rows", async () => {
    assert.equal((await appDb.select().from(branchReceiptSettings)).length, 0);
  });

  await t.test("tenant A cannot insert receipt settings for tenant B", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(branchReceiptSettings).values({
          businessId: businessBId,
          branchId: branchBId,
          headerLines: [],
          footerLines: [],
          paperWidth: "58mm",
          bilingualMode: "fr_only",
          qrCodeMode: "none",
        }),
      ),
      (error) =>
        /row-level security policy|violates row-level security/i.test(
          `${String(error)} ${String((error as { cause?: unknown }).cause)}`,
        ),
    );
  });
});

test("receipt-settings endpoint presents defaults before a row exists", async () => {
  const token = tokenFor(businessBId, userBId, ownerRoleBId);
  const response = await apiGet(`/v1/branches/${branchBId}/receipt-settings`, token);
  const body = (await response.json()) as {
    paperWidth: string;
    bilingualMode: string;
    showTaxBreakdown: boolean;
    headerLines: unknown[];
    isDefaultPresentation: boolean;
  };
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.paperWidth, "80mm");
  assert.equal(body.bilingualMode, "fr_only");
  assert.equal(body.showTaxBreakdown, true);
  assert.deepEqual(body.headerLines, []);
  assert.equal(body.isDefaultPresentation, true);
});

test("receipt-settings endpoint upserts branch receipt settings", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const response = await apiJson(`/v1/branches/${branchAId}/receipt-settings`, "PUT", token, {
    logoUrl: "https://cdn.example.test/logo.png",
    headerLines: [{ locale: "fr", text: "Cafe Atlas" }],
    footerLines: [{ locale: "fr", text: "Merci pour votre visite" }],
    showItemCodes: true,
    showTaxBreakdown: true,
    showServerName: false,
    showTableNumber: true,
    bilingualMode: "stacked",
    paperWidth: "58mm",
    qrCodeMode: "custom_url",
    qrCodeUrl: "https://example.test/fidelite",
  });
  const body = (await response.json()) as {
    logoUrl: string | null;
    paperWidth: string;
    bilingualMode: string;
    qrCodeMode: string;
    isDefaultPresentation: boolean;
  };
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.logoUrl, "https://cdn.example.test/logo.png");
  assert.equal(body.paperWidth, "58mm");
  assert.equal(body.bilingualMode, "stacked");
  assert.equal(body.qrCodeMode, "custom_url");
  assert.equal(body.isDefaultPresentation, false);
});

test("receipt-settings endpoint validates custom QR URLs, enums, and line content", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const baseBody = {
    logoUrl: null,
    headerLines: [],
    footerLines: [],
    showItemCodes: false,
    showTaxBreakdown: true,
    showServerName: true,
    showTableNumber: true,
    bilingualMode: "fr_only",
    paperWidth: "80mm",
    qrCodeMode: "none",
    qrCodeUrl: null,
  };

  const missingQrUrl = await apiJson(`/v1/branches/${branchAId}/receipt-settings`, "PUT", token, {
    ...baseBody,
    qrCodeMode: "custom_url",
  });
  assert.equal(missingQrUrl.status, 400, await missingQrUrl.text());

  const invalidPaperWidth = await apiJson(`/v1/branches/${branchAId}/receipt-settings`, "PUT", token, {
    ...baseBody,
    paperWidth: "72mm",
  });
  assert.equal(invalidPaperWidth.status, 400, await invalidPaperWidth.text());

  const invalidLine = await apiJson(`/v1/branches/${branchAId}/receipt-settings`, "PUT", token, {
    ...baseBody,
    headerLines: [{ locale: "fr", text: " " }],
  });
  assert.equal(invalidLine.status, 400, await invalidLine.text());
});

test("receipt-settings preview honors toggles and decimal-string sample amounts", async () => {
  const token = tokenFor(businessAId, userAId, ownerRoleAId);
  const response = await apiJson(`/v1/branches/${branchAId}/receipt-settings/preview`, "POST", token, {
    logoUrl: null,
    headerLines: [{ locale: "fr", text: "Cafe Atlas" }],
    footerLines: [{ locale: "fr", text: "A bientot" }],
    showItemCodes: false,
    showTaxBreakdown: false,
    showServerName: false,
    showTableNumber: false,
    bilingualMode: "fr_only",
    paperWidth: "58mm",
    qrCodeMode: "custom_url",
    qrCodeUrl: "https://example.test/reviews",
  });
  const body = (await response.json()) as { renderedText: string; sampleTotal: string };
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.match(body.renderedText, /Cafe Atlas/);
  assert.match(body.renderedText, /TOTAL\s+120\.00 MAD/);
  assert.doesNotMatch(body.renderedText, /TVA/);
  assert.doesNotMatch(body.renderedText, /Serveur/);
  assert.match(body.renderedText, /QR: https:\/\/example\.test\/reviews/);
  assert.equal(body.sampleTotal, "120.00");
});

async function seedRolesAndPermissions(businessId: string): Promise<void> {
  const permissionIds = ["settings.view", "settings.update"];

  await adminDb
    .insert(permissions)
    .values(
      permissionIds.map((id) => ({
        id,
        description: id,
        category: "settings",
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
  method: "POST" | "PUT",
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
