import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  businesses,
  permissions,
  permissionVersions,
  rolePermissions,
  roles,
} from "../schema";

const packageRoot = process.cwd();

for (const envPath of [
  path.resolve(packageRoot, "../../apps/qr-menu/.env"),
  path.resolve(packageRoot, "../../.env"),
]) {
  if (existsSync(envPath)) {
    config({ path: envPath });
  }
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const STARTER_PERMISSIONS = [
  ["business.view", "View business profile and settings", "business"],
  ["business.update", "Update business profile and settings", "business"],
  ["branch.view", "View branches", "branch"],
  ["branch.create", "Create branches", "branch"],
  ["branch.update", "Update branches", "branch"],
  ["branch.delete", "Delete branches", "branch"],
  ["settings.view", "View branch settings", "settings"],
  ["settings.update", "Update branch settings", "settings"],
  ["payment_methods.view", "View payment methods", "payment_methods"],
  ["payment_methods.update", "Update payment methods", "payment_methods"],
  ["tax.view", "View tax configuration", "tax"],
  ["tax.update", "Update tax configuration", "tax"],
  ["printer.view", "View printer setup", "printer"],
  ["printer.manage", "Manage printer setup", "printer"],
  ["staff.view", "View staff", "staff"],
  ["staff.create", "Create staff", "staff"],
  ["staff.update", "Update staff", "staff"],
  ["staff.delete", "Delete staff", "staff"],
  ["audit_log.view", "View audit log", "audit_log"],
  ["report.daily_summary.view", "View daily summary report", "reports"],
  ["order.view", "View orders", "order"],
  ["order.create", "Create orders", "order"],
  ["order.update", "Update orders", "order"],
  ["order.void", "Void orders", "order"],
  ["order.refund", "Refund orders", "order"],
  ["menu.view", "View menu", "menu"],
  ["menu.manage", "Manage menu catalog", "menu"],
  ["menu.update", "Update menu", "menu"],
  ["manager.override", "Approve manager override actions", "staff"],
] as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  Owner: STARTER_PERMISSIONS.map(([id]) => id),
  Manager: STARTER_PERMISSIONS.map(([id]) => id).filter(
    (id) => !["staff.delete"].includes(id),
  ),
  Cashier: [
    "business.view",
    "branch.view",
    "settings.view",
    "payment_methods.view",
    "tax.view",
    "printer.view",
    "order.view",
    "order.create",
    "order.update",
    "menu.view",
  ],
  Waiter: [
    "business.view",
    "branch.view",
    "settings.view",
    "payment_methods.view",
    "tax.view",
    "printer.view",
    "order.view",
    "order.create",
    "order.update",
    "menu.view",
  ],
  Kitchen: [
    "branch.view",
    "settings.view",
    "payment_methods.view",
    "tax.view",
    "printer.view",
    "order.view",
    "menu.view",
  ],
};

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, {
    schema: {
      businesses,
      permissions,
      permissionVersions,
      rolePermissions,
      roles,
    },
  });

  try {
    await db
      .insert(permissions)
      .values(
        STARTER_PERMISSIONS.map(([id, description, category]) => ({
          id,
          description,
          category,
        })),
      )
      .onConflictDoNothing();

    const tenantRows = await db.query.businesses.findMany({
      columns: { id: true, name: true },
    });

    for (const business of tenantRows) {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql.raw(`SET LOCAL app.current_business_id = '${business.id}'`),
        );

        await tx
          .insert(permissionVersions)
          .values({ businessId: business.id, version: 1 })
          .onConflictDoNothing();

        for (const [name, permissionIds] of Object.entries(ROLE_PERMISSIONS)) {
          const [role] = await tx
            .insert(roles)
            .values({ businessId: business.id, name, isSystem: true })
            .onConflictDoUpdate({
              target: [roles.businessId, roles.name],
              set: { isSystem: true },
            })
            .returning({ id: roles.id });

          if (!role) {
            continue;
          }

          await tx
            .insert(rolePermissions)
            .values(
              permissionIds.map((permissionId) => ({
                roleId: role.id,
                permissionId,
              })),
            )
            .onConflictDoNothing();
        }

        await tx
          .update(permissionVersions)
          .set({ version: sql`greatest(${permissionVersions.version}, 5)` })
          .where(sql`${permissionVersions.businessId} = ${business.id}`);
      });

      console.log(`Seeded permissions for ${business.name} (${business.id})`);
    }
  } finally {
    await pool.end();
  }
}

void main();
