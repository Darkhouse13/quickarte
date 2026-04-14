import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users } from "./identity";
import { categories, products } from "./catalog";
import { orders, reservations } from "./ordering";
import { promoCodes } from "./growth";

export const businessTypeEnum = pgEnum("business_type", [
  "restaurant",
  "cafe",
  "hotel",
  "retail",
  "other",
]);

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: businessTypeEnum("type").notNull().default("cafe"),
  city: text("city"),
  address: text("address"),
  logo: text("logo"),
  cover: text("cover"),
  currency: text("currency").notNull().default("MAD"),
  timezone: text("timezone").notNull().default("Africa/Casablanca"),
  locale: text("locale").notNull().default("fr"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const businessSettings = pgTable("business_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  businessId: uuid("business_id")
    .notNull()
    .unique()
    .references(() => businesses.id, { onDelete: "cascade" }),
  orderingEnabled: boolean("ordering_enabled").notNull().default(true),
  reservationsEnabled: boolean("reservations_enabled")
    .notNull()
    .default(false),
  dineInEnabled: boolean("dine_in_enabled").notNull().default(true),
  takeawayEnabled: boolean("takeaway_enabled").notNull().default(true),
  deliveryEnabled: boolean("delivery_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, {
    fields: [businesses.ownerId],
    references: [users.id],
  }),
  settings: one(businessSettings, {
    fields: [businesses.id],
    references: [businessSettings.businessId],
  }),
  categories: many(categories),
  products: many(products),
  orders: many(orders),
  reservations: many(reservations),
  promoCodes: many(promoCodes),
}));

export const businessSettingsRelations = relations(
  businessSettings,
  ({ one }) => ({
    business: one(businesses, {
      fields: [businessSettings.businessId],
      references: [businesses.id],
    }),
  }),
);

export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type BusinessSettings = typeof businessSettings.$inferSelect;
