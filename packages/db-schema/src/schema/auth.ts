import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { businesses } from "./business";
import { users } from "./identity";

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id").notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessNameUnique: uniqueIndex("roles_business_name_unique").on(
      table.businessId,
      table.name,
    ),
    businessIdx: index("roles_business_id_idx").on(table.businessId),
  }),
);

export const permissions = pgTable("permissions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  description: text("description").notNull(),
  category: varchar("category", { length: 32 }).notNull(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: varchar("permission_id", { length: 64 })
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
    permissionIdx: index("role_permissions_permission_id_idx").on(
      table.permissionId,
    ),
  }),
);

export const permissionVersions = pgTable("permission_versions", {
  businessId: uuid("business_id").primaryKey(),
  version: integer("version").notNull().default(1),
});

export const apiRefreshTokens = pgTable(
  "api_refresh_tokens",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessUserIdx: index("api_refresh_tokens_business_user_idx").on(
      table.businessId,
      table.userId,
    ),
    activeTokenIdx: index("api_refresh_tokens_active_idx")
      .on(table.businessId, table.expiresAt)
      .where(sql`${table.revokedAt} is null`),
  }),
);

export const rolesRelations = relations(roles, ({ one, many }) => ({
  business: one(businesses, {
    fields: [roles.businessId],
    references: [businesses.id],
  }),
  permissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roles: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const apiRefreshTokensRelations = relations(apiRefreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [apiRefreshTokens.userId],
    references: [users.id],
  }),
}));

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type PermissionVersion = typeof permissionVersions.$inferSelect;
export type ApiRefreshToken = typeof apiRefreshTokens.$inferSelect;
