import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  accounts,
  businesses,
  permissionVersions,
  permissions,
  rolePermissions,
  roles,
  staffMembers,
  users,
} from "@quickarte/db-schema";
import * as schema from "@quickarte/db-schema";
import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
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
let businessSlug: string;
let ownerEmail: string;
let managerEmail: string;
let cashierEmail: string;

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

  const runId = randomUUID();
  const businessId = randomUUID();
  const ownerUserId = randomUUID();
  const managerUserId = randomUUID();
  const cashierUserId = randomUUID();
  businessSlug = `admin-${runId}`;
  ownerEmail = `owner-${runId}@example.test`;
  managerEmail = `manager-${runId}@example.test`;
  cashierEmail = `cashier-${runId}@example.test`;
  const passwordHash = await hashPassword("quickarte123");

  await adminDb.insert(users).values([
    { id: ownerUserId, name: "Admin Owner", email: ownerEmail, role: "owner" },
    { id: managerUserId, name: "Admin Manager", email: managerEmail, role: "staff" },
    { id: cashierUserId, name: "Admin Cashier", email: cashierEmail, role: "staff" },
  ]);

  await adminDb.insert(accounts).values([
    {
      userId: ownerUserId,
      accountId: ownerUserId,
      providerId: "credential",
      password: passwordHash,
    },
    {
      userId: managerUserId,
      accountId: managerUserId,
      providerId: "credential",
      password: passwordHash,
    },
    {
      userId: cashierUserId,
      accountId: cashierUserId,
      providerId: "credential",
      password: passwordHash,
    },
  ]);

  await adminDb.insert(businesses).values({
    id: businessId,
    ownerId: ownerUserId,
    name: "Admin Tenant",
    slug: businessSlug,
    type: "restaurant",
  });

  await adminDb.insert(staffMembers).values([
    {
      businessId,
      userId: ownerUserId,
      email: ownerEmail,
      displayName: "Admin Owner",
      role: "owner",
      acceptedAt: new Date(),
    },
    {
      businessId,
      userId: managerUserId,
      email: managerEmail,
      displayName: "Admin Manager",
      role: "manager",
      acceptedAt: new Date(),
    },
    {
      businessId,
      userId: cashierUserId,
      email: cashierEmail,
      displayName: "Admin Cashier",
      role: "cashier",
      acceptedAt: new Date(),
    },
  ]);

  await adminDb.insert(permissions).values([
    { id: "business.view", description: "View business", category: "business" },
  ]).onConflictDoNothing();

  await adminDb.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL app.current_business_id = '${businessId}'`));
    await tx.insert(permissionVersions).values({ businessId, version: 1 });
    const [ownerRole] = await tx
      .insert(roles)
      .values({ businessId, name: "Owner", isSystem: true })
      .returning({ id: roles.id });
    const [managerRole] = await tx
      .insert(roles)
      .values({ businessId, name: "Manager", isSystem: true })
      .returning({ id: roles.id });
    const [cashierRole] = await tx
      .insert(roles)
      .values({ businessId, name: "Cashier", isSystem: true })
      .returning({ id: roles.id });

    assert.ok(ownerRole);
    assert.ok(managerRole);
    assert.ok(cashierRole);

    await tx.insert(rolePermissions).values([
      { roleId: ownerRole.id, permissionId: "business.view" },
      { roleId: managerRole.id, permissionId: "business.view" },
      { roleId: cashierRole.id, permissionId: "business.view" },
    ]);
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
});

after(async () => {
  await app?.close();
  await adminPool?.end();
});

test("valid owner login returns an API token pair", async () => {
  const response = await ownerLogin(ownerEmail, "quickarte123", businessSlug, "198.51.100.11");
  const body = await response.json() as { accessToken: string; refreshToken: string };

  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(typeof body.accessToken, "string");
  assert.equal(typeof body.refreshToken, "string");
});

test("invalid owner password returns auth-invalid-credentials", async () => {
  const response = await ownerLogin(ownerEmail, "wrong-password", businessSlug, "198.51.100.12");
  const body = await response.json() as { type: string };

  assert.equal(response.status, 401, JSON.stringify(body));
  assert.equal(body.type, "https://api.quickarte.ma/problems/auth-invalid-credentials");
});

test("unknown business slug returns the same auth-invalid-credentials problem", async () => {
  const response = await ownerLogin(ownerEmail, "quickarte123", "missing-business", "198.51.100.13");
  const body = await response.json() as { type: string };

  assert.equal(response.status, 401, JSON.stringify(body));
  assert.equal(body.type, "https://api.quickarte.ma/problems/auth-invalid-credentials");
});

test("cashier credentials cannot use owner login", async () => {
  const response = await ownerLogin(cashierEmail, "quickarte123", businessSlug, "198.51.100.14");
  const body = await response.json() as { type: string };

  assert.equal(response.status, 401, JSON.stringify(body));
  assert.equal(body.type, "https://api.quickarte.ma/problems/auth-invalid-credentials");
});

test("owner login locks out after five failed attempts", async () => {
  let response: Response | undefined;
  for (let i = 0; i < 6; i += 1) {
    response = await ownerLogin(managerEmail, "wrong-password", businessSlug, "198.51.100.15");
  }

  const body = await response!.json() as { type: string };
  assert.equal(response?.status, 429, JSON.stringify(body));
  assert.equal(body.type, "https://api.quickarte.ma/problems/rate-limit-exceeded");
});

async function ownerLogin(
  email: string,
  password: string,
  slug: string,
  ip: string,
): Promise<Response> {
  return fetch(`${baseUrl}/v1/auth/owner/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: JSON.stringify({ email, password, businessSlug: slug }),
  });
}
