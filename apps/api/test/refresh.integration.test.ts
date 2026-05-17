import "reflect-metadata";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  accounts,
  apiRefreshTokens,
  businesses,
  permissionVersions,
  permissions,
  rolePermissions,
  roles,
  staffMembers,
  users,
} from "@quickarte/db-schema";
import * as schema from "@quickarte/db-schema";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { hashBetterAuthPassword } from "../src/auth/better-auth-password";
import { ProblemDetailsFilter } from "../src/common/filters/problem-details.filter";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgres://quickarte:quickarte@localhost:5433/quickarte";
const appRoleUrl =
  process.env.TEST_APP_DATABASE_URL ??
  "postgres://quickarte_rls_test:quickarte_rls_test@localhost:5433/quickarte";
const migrationsFolder = "../../packages/db-schema/migrations";
const jwtSecret = "test-secret-test-secret-test-secret-test";

let adminPool: Pool;
let adminDb: ReturnType<typeof drizzle<typeof schema>>;
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let baseUrl: string;
let businessId: string;
let otherBusinessId: string;
let businessSlug: string;
let ownerEmail: string;
let userId: string;

before(async () => {
  process.env.DATABASE_URL = appRoleUrl;
  process.env.JWT_SECRET = jwtSecret;
  process.env.JWT_ISSUER = "http://localhost:3001";
  process.env.JWT_AUDIENCE = "quickarte-api";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.LOG_LEVEL = "silent";
  process.env.NODE_ENV = "test";

  adminPool = new Pool({ connectionString: databaseUrl });
  adminDb = drizzle(adminPool, { schema });
  await migrate(adminDb, { migrationsFolder });

  const runId = randomUUID();
  businessId = randomUUID();
  otherBusinessId = randomUUID();
  userId = randomUUID();
  businessSlug = `refresh-${runId}`;
  ownerEmail = `refresh-owner-${runId}@example.test`;
  const passwordHash = await hashBetterAuthPassword("quickarte123");

  await adminDb.insert(users).values({
    id: userId,
    name: "Refresh Owner",
    email: ownerEmail,
    role: "owner",
  });

  await adminDb.insert(accounts).values({
    userId,
    accountId: userId,
    providerId: "credential",
    password: passwordHash,
  });

  await adminDb.insert(businesses).values([
    {
      id: businessId,
      ownerId: userId,
      name: "Refresh Tenant",
      slug: businessSlug,
      type: "restaurant",
    },
    {
      id: otherBusinessId,
      ownerId: userId,
      name: "Other Refresh Tenant",
      slug: `other-${businessSlug}`,
      type: "restaurant",
    },
  ]);

  await adminDb.insert(staffMembers).values({
    businessId,
    userId,
    email: ownerEmail,
    displayName: "Refresh Owner",
    role: "owner",
    acceptedAt: new Date(),
  });

  await adminDb.insert(permissions).values([
    { id: "business.view", description: "View business", category: "business" },
  ]).onConflictDoNothing();

  await adminDb.transaction(async (tx) => {
    await tx.execute(
      sql.raw(`SET LOCAL app.current_business_id = '${businessId}'`),
    );
    await tx.insert(permissionVersions).values({ businessId, version: 1 });
    const [ownerRole] = await tx
      .insert(roles)
      .values({ businessId, name: "Owner", isSystem: true })
      .returning({ id: roles.id });

    assert.ok(ownerRole);
    await tx.insert(rolePermissions).values({
      roleId: ownerRole.id,
      permissionId: "business.view",
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
});

after(async () => {
  await app?.close();
  await adminPool?.end();
});

test("valid refresh token returns a new pair and revokes the old token", async () => {
  const oldRefreshToken = await loginAndGetRefreshToken();
  const response = await refresh(oldRefreshToken);
  const body = await response.json() as {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
  };

  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(typeof body.accessToken, "string");
  assert.equal(typeof body.refreshToken, "string");
  assert.notEqual(body.refreshToken, oldRefreshToken);
  assert.equal(body.tokenType, "Bearer");
  assert.equal(body.expiresIn, 900);

  const [oldRow] = await adminDb
    .select({ revokedAt: apiRefreshTokens.revokedAt })
    .from(apiRefreshTokens)
    .where(eq(apiRefreshTokens.tokenHash, hashOpaqueToken(oldRefreshToken)))
    .limit(1);

  assert.ok(oldRow?.revokedAt);
});

test("revoked refresh token returns auth-refresh-invalid", async () => {
  const oldRefreshToken = await loginAndGetRefreshToken();
  await refresh(oldRefreshToken);

  const response = await refresh(oldRefreshToken);
  const body = await response.json() as { type: string };

  assert.equal(response.status, 401, JSON.stringify(body));
  assert.equal(body.type, "https://api.quickarte.ma/problems/auth-refresh-invalid");
});

test("expired refresh token returns auth-refresh-invalid", async () => {
  const expiredToken = `expired-${randomUUID()}`;
  await adminDb.transaction(async (tx) => {
    await tx.execute(
      sql.raw(`SET LOCAL app.current_business_id = '${businessId}'`),
    );
    await tx.insert(apiRefreshTokens).values({
      businessId,
      userId,
      tokenHash: hashOpaqueToken(expiredToken),
      expiresAt: new Date(Date.now() - 60_000),
    });
  });

  const response = await refresh(expiredToken);
  const body = await response.json() as { type: string };

  assert.equal(response.status, 401, JSON.stringify(body));
  assert.equal(body.type, "https://api.quickarte.ma/problems/auth-refresh-invalid");
});

test("refresh token cannot be used with a different tenant context", async () => {
  const token = await loginAndGetRefreshToken();
  const response = await refresh(token, otherBusinessId);
  const body = await response.json() as { type: string };

  assert.equal(response.status, 401, JSON.stringify(body));
  assert.equal(body.type, "https://api.quickarte.ma/problems/auth-refresh-invalid");
});

test("refresh after permissions_version bump returns a JWT with the bumped version", async () => {
  const token = await loginAndGetRefreshToken();
  await adminDb.transaction(async (tx) => {
    await tx.execute(
      sql.raw(`SET LOCAL app.current_business_id = '${businessId}'`),
    );
    await tx
      .update(permissionVersions)
      .set({ version: 7 })
      .where(eq(permissionVersions.businessId, businessId));
  });

  const response = await refresh(token);
  const body = await response.json() as { accessToken: string };
  const payload = decodeJwtPayload(body.accessToken);

  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(payload.permissions_version, 7);
});

async function loginAndGetRefreshToken(): Promise<string> {
  const response = await fetch(`${baseUrl}/v1/auth/owner/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": `203.0.113.${Math.floor(Math.random() * 200)}`,
    },
    body: JSON.stringify({
      email: ownerEmail,
      password: "quickarte123",
      businessSlug,
    }),
  });
  const body = await response.json() as { refreshToken: string };
  assert.equal(response.status, 200, JSON.stringify(body));
  return body.refreshToken;
}

async function refresh(token: string, tenantHeader?: string): Promise<Response> {
  return fetch(`${baseUrl}/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(tenantHeader ? { "X-Tenant-Id": tenantHeader } : {}),
    },
    body: JSON.stringify({ refreshToken: token }),
  });
}

function hashOpaqueToken(token: string): string {
  return createHmac("sha256", jwtSecret).update(token).digest("hex");
}

function decodeJwtPayload(token: string): { permissions_version: number } {
  const [, encodedPayload] = token.split(".");
  assert.ok(encodedPayload);
  return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
    permissions_version: number;
  };
}
