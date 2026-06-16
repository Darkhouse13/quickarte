import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { businesses } from "./business";

export const mizaneIntegrations = pgTable("mizane_integrations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  businessId: uuid("business_id")
    .notNull()
    .unique()
    .references(() => businesses.id, { onDelete: "cascade" }),
  // Stored plaintext for now — encrypt at app layer before moving to prod
  apiKey: text("api_key").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const mizaneIntegrationsRelations = relations(
  mizaneIntegrations,
  ({ one }) => ({
    business: one(businesses, {
      fields: [mizaneIntegrations.businessId],
      references: [businesses.id],
    }),
  }),
);

export type MizaneIntegration = typeof mizaneIntegrations.$inferSelect;
