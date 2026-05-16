import { index, inet, jsonb, pgTable, timestamp, uuid, varchar, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id").notNull(),
    actorUserId: uuid("actor_user_id"),
    action: varchar("action", { length: 64 }).notNull(),
    entityType: varchar("entity_type", { length: 64 }),
    entityId: uuid("entity_id"),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    requestId: uuid("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessCreatedIdx: index("audit_log_business_created_idx").on(
      table.businessId,
      table.createdAt.desc(),
    ),
    entityIdx: index("audit_log_entity_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt.desc(),
    ),
  }),
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
