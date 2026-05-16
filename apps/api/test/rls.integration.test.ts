import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq, inArray, sql } from "drizzle-orm";
import { Pool } from "pg";
import { auditLog, businesses, users } from "@quickarte/db-schema";
import * as schema from "@quickarte/db-schema";
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
let pool: Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;
let adminDb: ReturnType<typeof drizzle<typeof schema>>;
let databaseService: DatabaseService;
let businessAId: string;
let businessBId: string;

before(async () => {
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

  pool = new Pool({ connectionString: appRoleUrl });
  db = drizzle(pool, { schema });
  databaseService = new DatabaseService(pool, db);

  const runId = randomUUID();
  const ownerAId = randomUUID();
  const ownerBId = randomUUID();
  businessAId = randomUUID();
  businessBId = randomUUID();

  await adminDb.insert(users).values([
    {
      id: ownerAId,
      name: "RLS Tenant A",
      email: `rls-a-${runId}@example.test`,
      role: "owner",
    },
    {
      id: ownerBId,
      name: "RLS Tenant B",
      email: `rls-b-${runId}@example.test`,
      role: "owner",
    },
  ]);

  await adminDb.insert(businesses).values([
    {
      id: businessAId,
      ownerId: ownerAId,
      name: "RLS Tenant A",
      slug: `rls-a-${runId}`,
      type: "restaurant",
    },
    {
      id: businessBId,
      ownerId: ownerBId,
      name: "RLS Tenant B",
      slug: `rls-b-${runId}`,
      type: "restaurant",
    },
  ]);
});

after(async () => {
  await pool?.end();
  await adminPool?.end();
});

test("audit_log RLS isolates rows by transaction-scoped tenant context", async (t) => {
  await t.test("1. seed data contains two businesses", async () => {
    const seededBusinesses = await adminDb
      .select()
      .from(businesses)
      .where(inArray(businesses.id, [businessAId, businessBId]));

    assert.equal(seededBusinesses.length, 2);
  });

  await t.test("2. tenant A can write an audit_log row for A", async () => {
    await databaseService.withTenant(businessAId, async (tx) => {
      await tx.insert(auditLog).values({
        businessId: businessAId,
        action: "rls.tenant_a.created",
      });
    });
  });

  await t.test("3. tenant B can write an audit_log row for B", async () => {
    await databaseService.withTenant(businessBId, async (tx) => {
      await tx.insert(auditLog).values({
        businessId: businessBId,
        action: "rls.tenant_b.created",
      });
    });
  });

  await t.test("4. tenant A reads only A's audit_log row", async () => {
    const tenantARows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(auditLog).where(eq(auditLog.businessId, businessAId)),
    );
    assert.equal(tenantARows.length, 1);
    assert.equal(tenantARows[0]?.businessId, businessAId);
    assert.equal(tenantARows[0]?.action, "rls.tenant_a.created");
  });

  await t.test("5. tenant B reads only B's audit_log row", async () => {
    const tenantBRows = await databaseService.withTenant(businessBId, (tx) =>
      tx.select().from(auditLog).where(eq(auditLog.businessId, businessBId)),
    );
    assert.equal(tenantBRows.length, 1);
    assert.equal(tenantBRows[0]?.businessId, businessBId);
    assert.equal(tenantBRows[0]?.action, "rls.tenant_b.created");
  });

  await t.test("6. direct query without tenant context reads zero rows", async () => {
    const noTenantRows = await db.select().from(auditLog);
    assert.equal(noTenantRows.length, 0);
  });

  await t.test("7. forged tenant A query for tenant B rows returns zero rows", async () => {
    const forgedRows = await databaseService.withTenant(businessAId, (tx) =>
      tx.select().from(auditLog).where(eq(auditLog.businessId, businessBId)),
    );
    assert.equal(forgedRows.length, 0);
  });

  await t.test("8. tenant A cannot insert an audit_log row for tenant B", async () => {
    await assert.rejects(
      databaseService.withTenant(businessAId, (tx) =>
        tx.insert(auditLog).values({
          businessId: businessBId,
          action: "rls.forged_insert",
        }),
      ),
      (error) =>
        /row-level security policy|violates row-level security/i.test(
          `${String(error)} ${String((error as { cause?: unknown }).cause)}`,
        ),
    );

    const tenantBAfterForgery = await databaseService.withTenant(businessBId, (tx) =>
      tx.select().from(auditLog).where(eq(auditLog.action, "rls.forged_insert")),
    );
    assert.equal(tenantBAfterForgery.length, 0);
  });

  const leakedSetting = await db.execute<{ current_business_id: string | null }>(
    sql`select current_setting('app.current_business_id', true) as current_business_id`,
  );
  assert.notEqual(leakedSetting.rows[0]?.current_business_id, businessAId);
  assert.notEqual(leakedSetting.rows[0]?.current_business_id, businessBId);
});
