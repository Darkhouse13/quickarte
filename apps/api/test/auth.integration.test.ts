import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { auditLog, businesses, permissionVersions, permissions, rolePermissions, roles, staffMembers, users } from "@quickarte/db-schema";
import * as schema from "@quickarte/db-schema";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { PinHashingService } from "../src/auth/pin-hashing.service";
import { ProblemDetailsFilter } from "../src/common/filters/problem-details.filter";

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
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let baseUrl: string;
let businessId: string;
let ownerJwt: string;
let cashierJwt: string;
let staleJwt: string;

before(async () => {
  try {
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

  const runId = randomUUID();
  businessId = randomUUID();
  const ownerUserId = randomUUID();
  const cashierUserId = randomUUID();
  const ownerStaffId = randomUUID();
  const cashierStaffId = randomUUID();
  const pinHashing = new PinHashingService();
  const ownerPinHash = await pinHashing.hash("1234");
  const cashierPinHash = await pinHashing.hash("5678");

  await adminDb.insert(users).values([
    {
      id: ownerUserId,
      name: "Auth Owner",
      email: `auth-owner-${runId}@example.test`,
      role: "owner",
    },
    {
      id: cashierUserId,
      name: "Auth Cashier",
      email: `auth-cashier-${runId}@example.test`,
      role: "staff",
    },
  ]);

  await adminDb.insert(businesses).values({
    id: businessId,
    ownerId: ownerUserId,
    name: "Auth Tenant",
    slug: `auth-${runId}`,
    type: "restaurant",
  });

  await adminDb.insert(staffMembers).values([
    {
      id: ownerStaffId,
      businessId,
      userId: ownerUserId,
      displayName: "Auth Owner",
      role: "owner",
      pinHash: ownerPinHash,
    },
    {
      id: cashierStaffId,
      businessId,
      userId: cashierUserId,
      displayName: "Auth Cashier",
      role: "cashier",
      pinHash: cashierPinHash,
    },
  ]);

  await adminDb.insert(permissions).values([
    { id: "audit_log.view", description: "View audit log", category: "audit_log" },
    { id: "business.view", description: "View business", category: "business" },
  ]).onConflictDoNothing();

  await adminDb.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL app.current_business_id = '${businessId}'`));
    await tx.insert(permissionVersions).values({ businessId, version: 1 });
    const [ownerRole] = await tx
      .insert(roles)
      .values({ businessId, name: "Owner", isSystem: true })
      .returning({ id: roles.id });
    const [cashierRole] = await tx
      .insert(roles)
      .values({ businessId, name: "Cashier", isSystem: true })
      .returning({ id: roles.id });

    assert.ok(ownerRole);
    assert.ok(cashierRole);

    await tx.insert(rolePermissions).values([
      { roleId: ownerRole.id, permissionId: "audit_log.view" },
      { roleId: ownerRole.id, permissionId: "business.view" },
      { roleId: cashierRole.id, permissionId: "business.view" },
    ]);
    await tx.insert(auditLog).values({
      businessId,
      actorUserId: ownerUserId,
      action: "auth.test.seeded",
    });
  });

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

  const address = app.getHttpServer().address();
  assert.equal(typeof address, "object");
  baseUrl = `http://127.0.0.1:${address.port}`;

  ownerJwt = await loginAndGetAccessToken("1234");
  cashierJwt = await loginAndGetAccessToken("5678");

  const jwtService = app.get(ConfigService);
  assert.equal(jwtService.get("JWT_AUDIENCE"), "quickarte-api");

  await adminDb.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL app.current_business_id = '${businessId}'`));
    await tx
      .update(permissionVersions)
      .set({ version: 2 })
      .where(eq(permissionVersions.businessId, businessId));
  });
  staleJwt = ownerJwt;
  ownerJwt = await loginAndGetAccessToken("1234");
  cashierJwt = await loginAndGetAccessToken("5678");
  } catch (error) {
    console.error("auth integration setup failed", error);
    throw error;
  }
});

after(async () => {
  await app?.close();
  await adminPool?.end();
});

test("owner role can list tenant audit_log entries", async () => {
  const response = await fetch(`${baseUrl}/v1/audit-log`, {
    headers: { Authorization: `Bearer ${ownerJwt}` },
  });
  const body = await response.json() as { items: Array<{ action: string }> };
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.ok(body.items.some((item) => item.action === "auth.test.seeded"));
});

test("cashier role without audit_log.view gets permission-denied", async () => {
  const response = await fetch(`${baseUrl}/v1/audit-log`, {
    headers: { Authorization: `Bearer ${cashierJwt}` },
  });
  const body = await response.json() as { type: string };
  assert.equal(response.status, 403, JSON.stringify(body));
  assert.equal(body.type, "https://api.quickarte.ma/problems/permission-denied");
});

test("missing JWT is rejected with auth-required", async () => {
  const response = await fetch(`${baseUrl}/v1/audit-log`);
  assert.equal(response.status, 401);
  const body = await response.json() as { type: string };
  assert.equal(body.type, "https://api.quickarte.ma/problems/auth-required");
});

test("stale permissions_version is rejected", async () => {
  const response = await fetch(`${baseUrl}/v1/audit-log`, {
    headers: { Authorization: `Bearer ${staleJwt}` },
  });
  assert.equal(response.status, 401);
  const body = await response.json() as { type: string };
  assert.equal(body.type, "https://api.quickarte.ma/problems/permissions-stale");
});

test("PIN login locks out after five failed attempts", async () => {
  let response: Response | undefined;
  for (let i = 0; i < 6; i += 1) {
    response = await fetch(`${baseUrl}/v1/auth/staff/pin-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "203.0.113.10",
      },
      body: JSON.stringify({ businessId, pin: "0000" }),
    });
  }

  assert.equal(response?.status, 429);
  const body = await response!.json() as { type: string };
  assert.equal(body.type, "https://api.quickarte.ma/problems/rate-limit-exceeded");
});

async function loginAndGetAccessToken(pin: string): Promise<string> {
  const response = await fetch(`${baseUrl}/v1/auth/staff/pin-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": `198.51.100.${pin}`,
    },
    body: JSON.stringify({ businessId, pin }),
  });
  const body = await response.json() as { accessToken: string };
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(typeof body.accessToken, "string");
  return body.accessToken;
}
