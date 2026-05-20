import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { staffMembers, users } from "./identity";
import { categories, products } from "./catalog";
import { orders, reservations } from "./ordering";
import { promoCodes } from "./growth";

export const businessTypeEnum = pgEnum("business_type", [
  "restaurant",
  "cafe",
  "autre",
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
  googlePlaceId: text("google_place_id"),
  formattedAddress: text("formatted_address"),
  lat: numeric("lat", { precision: 10, scale: 7 }),
  lng: numeric("lng", { precision: 10, scale: 7 }),
  logo: text("logo"),
  cover: text("cover"),
  currency: text("currency").notNull().default("MAD"),
  timezone: text("timezone").notNull().default("Africa/Casablanca"),
  locale: text("locale").notNull().default("fr-MA"),
  stripeAccountId: text("stripe_account_id"),
  stripeChargesEnabled: boolean("stripe_charges_enabled")
    .notNull()
    .default(false),
  stripePayoutsEnabled: boolean("stripe_payouts_enabled")
    .notNull()
    .default(false),
  stripeOnboardingCompletedAt: timestamp("stripe_onboarding_completed_at", {
    withTimezone: true,
  }),
  secondaryCurrency: text("secondary_currency"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    postcode: varchar("postcode", { length: 16 }),
    countryCode: varchar("country_code", { length: 2 }).notNull().default("MA"),
    googlePlaceId: text("google_place_id"),
    formattedAddress: text("formatted_address"),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    socialLinks: jsonb("social_links"),
    logo: text("logo"),
    cuisineType: text("cuisine_type"),
    seatingCapacity: integer("seating_capacity"),
    currency: text("currency"),
    timezone: text("timezone"),
    locale: text("locale"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    businessSlugUnique: uniqueIndex("branches_business_slug_unique").on(
      table.businessId,
      table.slug,
    ),
    defaultBranchUnique: uniqueIndex("branches_one_default_per_business_idx")
      .on(table.businessId)
      .where(sql`${table.isDefault} = true and ${table.deletedAt} is null`),
    businessIdx: index("branches_business_id_idx").on(table.businessId),
    activeIdx: index("branches_business_active_idx")
      .on(table.businessId, table.deletedAt)
      .where(sql`${table.deletedAt} is null`),
    seatingCapacityCheck: check(
      "branches_seating_capacity_non_negative",
      sql`${table.seatingCapacity} is null or ${table.seatingCapacity} >= 0`,
    ),
  }),
);

export const businessLegalProfiles = pgTable("business_legal_profiles", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  legalName: text("legal_name").notNull(),
  iceNumber: varchar("ice_number", { length: 32 }),
  rcNumber: varchar("rc_number", { length: 32 }),
  ifNumber: varchar("if_number", { length: 32 }),
  patenteNumber: varchar("patente_number", { length: 32 }),
  cnssNumber: varchar("cnss_number", { length: 32 }),
  legalAddress: text("legal_address"),
  legalCity: text("legal_city"),
  legalPostcode: varchar("legal_postcode", { length: 16 }),
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
  menuQrEnabled: boolean("menu_qr_enabled").notNull().default(true),
  orderingEnabled: boolean("ordering_enabled").notNull().default(true),
  loyaltyEnabled: boolean("loyalty_enabled").notNull().default(true),
  analyticsEnabled: boolean("analytics_enabled").notNull().default(true),
  reservationsEnabled: boolean("reservations_enabled")
    .notNull()
    .default(false),
  dineInEnabled: boolean("dine_in_enabled").notNull().default(true),
  takeawayEnabled: boolean("takeaway_enabled").notNull().default(true),
  deliveryEnabled: boolean("delivery_enabled").notNull().default(false),
  tableQrCount: integer("table_qr_count").notNull().default(0),
  whatsappNumber: text("whatsapp_number"),
  customerPostOrderMessage: text("customer_post_order_message"),
  posCoexistenceEnabled: boolean("pos_coexistence_enabled")
    .notNull()
    .default(false),
  googlePlaceId: text("google_place_id"),
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
  legalProfile: one(businessLegalProfiles, {
    fields: [businesses.id],
    references: [businessLegalProfiles.businessId],
  }),
  branches: many(branches),
  categories: many(categories),
  products: many(products),
  orders: many(orders),
  reservations: many(reservations),
  promoCodes: many(promoCodes),
  staffMembers: many(staffMembers),
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

export const branchesRelations = relations(branches, ({ one }) => ({
  business: one(businesses, {
    fields: [branches.businessId],
    references: [businesses.id],
  }),
}));

export const businessLegalProfilesRelations = relations(
  businessLegalProfiles,
  ({ one }) => ({
    business: one(businesses, {
      fields: [businessLegalProfiles.businessId],
      references: [businesses.id],
    }),
  }),
);

export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
export type BusinessLegalProfile = typeof businessLegalProfiles.$inferSelect;
export type NewBusinessLegalProfile = typeof businessLegalProfiles.$inferInsert;
export type BusinessSettings = typeof businessSettings.$inferSelect;
