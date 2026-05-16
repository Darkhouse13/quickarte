import {
  boolean,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { businesses } from "./business";

export const moduleKeyEnum = pgEnum("module_key", [
  "menu_qr",
  "online_ordering",
  "loyalty",
  "analytics",
]);

export const entitlementSourceEnum = pgEnum("entitlement_source", [
  "trial",
  "paid",
  "manual",
  "grandfathered",
]);

export const businessEntitlements = pgTable(
  "business_entitlements",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    module: moduleKeyEnum("module").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    planTier: text("plan_tier"),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    source: entitlementSourceEnum("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.businessId, table.module] }),
    businessIdx: index("business_entitlements_business_id_idx").on(
      table.businessId,
    ),
  }),
);

export const businessEntitlementsRelations = relations(
  businessEntitlements,
  ({ one }) => ({
    business: one(businesses, {
      fields: [businessEntitlements.businessId],
      references: [businesses.id],
    }),
  }),
);

export type BusinessEntitlement = typeof businessEntitlements.$inferSelect;
export type NewBusinessEntitlement = typeof businessEntitlements.$inferInsert;
