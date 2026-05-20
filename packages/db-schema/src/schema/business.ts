import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
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
    ).where(sql`${table.deletedAt} is null`),
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

export const branchOperatingHours = pgTable(
  "branch_operating_hours",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    scheduleType: varchar("schedule_type", { length: 24 })
      .notNull()
      .default("normal"),
    dayOfWeek: smallint("day_of_week").notNull(),
    opensAt: time("opens_at"),
    closesAt: time("closes_at"),
    isClosed: boolean("is_closed").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    branchScheduleUnique: uniqueIndex("branch_operating_hours_unique").on(
      table.branchId,
      table.scheduleType,
      table.dayOfWeek,
      table.position,
    ),
    businessIdx: index("branch_operating_hours_business_idx").on(
      table.businessId,
    ),
    branchIdx: index("branch_operating_hours_branch_idx").on(table.branchId),
    scheduleTypeCheck: check(
      "branch_operating_hours_schedule_type_check",
      sql`${table.scheduleType} in ('normal', 'ramadan')`,
    ),
    dayOfWeekCheck: check(
      "branch_operating_hours_day_check",
      sql`${table.dayOfWeek} between 0 and 6`,
    ),
    timeClosedCheck: check(
      "branch_operating_hours_time_closed_check",
      sql`(${table.isClosed} = true and ${table.opensAt} is null and ${table.closesAt} is null) or (${table.isClosed} = false and ${table.opensAt} is not null and ${table.closesAt} is not null)`,
    ),
  }),
);

export const branchScheduleSettings = pgTable("branch_schedule_settings", {
  branchId: uuid("branch_id")
    .primaryKey()
    .references(() => branches.id, { onDelete: "cascade" }),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  ramadanModeEnabled: boolean("ramadan_mode_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const branchClosedDays = pgTable(
  "branch_closed_days",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    branchDateUnique: uniqueIndex("branch_closed_days_branch_date_unique").on(
      table.branchId,
      table.date,
    ),
    businessIdx: index("branch_closed_days_business_idx").on(table.businessId),
    branchIdx: index("branch_closed_days_branch_idx").on(table.branchId),
  }),
);

export const paymentMethodDefinitions = pgTable("payment_method_definitions", {
  code: varchar("code", { length: 64 }).primaryKey(),
  label: text("label").notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  isBuiltin: boolean("is_builtin").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const branchPaymentMethods = pgTable(
  "branch_payment_methods",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    methodCode: varchar("method_code", { length: 64 }).references(
      () => paymentMethodDefinitions.code,
      { onDelete: "restrict" },
    ),
    customName: text("custom_name"),
    enabled: boolean("enabled").notNull().default(true),
    cashDrawerAutoOpen: boolean("cash_drawer_auto_open")
      .notNull()
      .default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    builtinUnique: uniqueIndex("branch_payment_methods_builtin_unique")
      .on(table.branchId, table.methodCode)
      .where(sql`${table.methodCode} is not null`),
    businessIdx: index("branch_payment_methods_business_idx").on(
      table.businessId,
    ),
    branchIdx: index("branch_payment_methods_branch_idx").on(table.branchId),
    builtinOrCustomCheck: check(
      "branch_payment_methods_builtin_or_custom_check",
      sql`(${table.methodCode} is not null and ${table.customName} is null) or (${table.methodCode} is null and ${table.customName} is not null)`,
    ),
  }),
);

export const taxRates = pgTable("tax_rates", {
  id: varchar("id", { length: 64 }).primaryKey(),
  countryCode: varchar("country_code", { length: 2 }).notNull().default("MA"),
  label: text("label").notNull(),
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const branchTaxSettings = pgTable(
  "branch_tax_settings",
  {
    branchId: uuid("branch_id")
      .primaryKey()
      .references(() => branches.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    defaultTaxRateId: varchar("default_tax_rate_id", { length: 64 })
      .notNull()
      .references(() => taxRates.id, { onDelete: "restrict" }),
    taxApplicationLevel: varchar("tax_application_level", { length: 24 })
      .notNull()
      .default("category"),
    priceDisplayMode: varchar("price_display_mode", { length: 24 })
      .notNull()
      .default("ttc"),
    serviceChargeEnabled: boolean("service_charge_enabled")
      .notNull()
      .default(false),
    serviceChargeRate: numeric("service_charge_rate", {
      precision: 5,
      scale: 2,
    }),
    serviceChargeLabel: text("service_charge_label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessIdx: index("branch_tax_settings_business_idx").on(
      table.businessId,
    ),
    defaultTaxRateIdx: index("branch_tax_settings_tax_rate_idx").on(
      table.defaultTaxRateId,
    ),
    taxApplicationLevelCheck: check(
      "branch_tax_settings_application_level_check",
      sql`${table.taxApplicationLevel} in ('item', 'category')`,
    ),
    priceDisplayModeCheck: check(
      "branch_tax_settings_price_display_mode_check",
      sql`${table.priceDisplayMode} in ('ttc', 'ht_plus_tva')`,
    ),
    serviceChargeRateRangeCheck: check(
      "branch_tax_settings_service_charge_rate_range_check",
      sql`${table.serviceChargeRate} is null or (${table.serviceChargeRate} >= 0 and ${table.serviceChargeRate} <= 100)`,
    ),
    serviceChargeEnabledRateCheck: check(
      "branch_tax_settings_service_charge_enabled_rate_check",
      sql`${table.serviceChargeEnabled} = false or ${table.serviceChargeRate} is not null`,
    ),
  }),
);

export const branchReceiptSettings = pgTable(
  "branch_receipt_settings",
  {
    branchId: uuid("branch_id")
      .primaryKey()
      .references(() => branches.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    logoUrl: text("logo_url"),
    headerLines: jsonb("header_lines").notNull().default(sql`'[]'::jsonb`),
    footerLines: jsonb("footer_lines").notNull().default(sql`'[]'::jsonb`),
    showItemCodes: boolean("show_item_codes").notNull().default(false),
    showTaxBreakdown: boolean("show_tax_breakdown").notNull().default(true),
    showServerName: boolean("show_server_name").notNull().default(true),
    showTableNumber: boolean("show_table_number").notNull().default(true),
    bilingualMode: varchar("bilingual_mode", { length: 24 })
      .notNull()
      .default("fr_only"),
    paperWidth: varchar("paper_width", { length: 8 }).notNull().default("80mm"),
    qrCodeMode: varchar("qr_code_mode", { length: 32 })
      .notNull()
      .default("none"),
    qrCodeUrl: text("qr_code_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessIdx: index("branch_receipt_settings_business_idx").on(
      table.businessId,
    ),
    bilingualModeCheck: check(
      "branch_receipt_settings_bilingual_mode_check",
      sql`${table.bilingualMode} in ('fr_only', 'ar_only', 'stacked', 'side_by_side')`,
    ),
    paperWidthCheck: check(
      "branch_receipt_settings_paper_width_check",
      sql`${table.paperWidth} in ('58mm', '80mm')`,
    ),
    qrCodeModeCheck: check(
      "branch_receipt_settings_qr_code_mode_check",
      sql`${table.qrCodeMode} in ('none', 'fidelity_signup', 'social_link', 'custom_url')`,
    ),
    qrCodeCustomUrlCheck: check(
      "branch_receipt_settings_custom_url_check",
      sql`${table.qrCodeMode} <> 'custom_url' or ${table.qrCodeUrl} is not null`,
    ),
  }),
);

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

export const branchOperatingHoursRelations = relations(
  branchOperatingHours,
  ({ one }) => ({
    branch: one(branches, {
      fields: [branchOperatingHours.branchId],
      references: [branches.id],
    }),
    business: one(businesses, {
      fields: [branchOperatingHours.businessId],
      references: [businesses.id],
    }),
  }),
);

export const branchScheduleSettingsRelations = relations(
  branchScheduleSettings,
  ({ one }) => ({
    branch: one(branches, {
      fields: [branchScheduleSettings.branchId],
      references: [branches.id],
    }),
    business: one(businesses, {
      fields: [branchScheduleSettings.businessId],
      references: [businesses.id],
    }),
  }),
);

export const branchClosedDaysRelations = relations(
  branchClosedDays,
  ({ one }) => ({
    branch: one(branches, {
      fields: [branchClosedDays.branchId],
      references: [branches.id],
    }),
    business: one(businesses, {
      fields: [branchClosedDays.businessId],
      references: [businesses.id],
    }),
  }),
);

export const branchPaymentMethodsRelations = relations(
  branchPaymentMethods,
  ({ one }) => ({
    branch: one(branches, {
      fields: [branchPaymentMethods.branchId],
      references: [branches.id],
    }),
    business: one(businesses, {
      fields: [branchPaymentMethods.businessId],
      references: [businesses.id],
    }),
    definition: one(paymentMethodDefinitions, {
      fields: [branchPaymentMethods.methodCode],
      references: [paymentMethodDefinitions.code],
    }),
  }),
);

export const taxRatesRelations = relations(taxRates, ({ many }) => ({
  branchSettings: many(branchTaxSettings),
}));

export const branchTaxSettingsRelations = relations(
  branchTaxSettings,
  ({ one }) => ({
    branch: one(branches, {
      fields: [branchTaxSettings.branchId],
      references: [branches.id],
    }),
    business: one(businesses, {
      fields: [branchTaxSettings.businessId],
      references: [businesses.id],
    }),
    defaultTaxRate: one(taxRates, {
      fields: [branchTaxSettings.defaultTaxRateId],
      references: [taxRates.id],
    }),
  }),
);

export const branchReceiptSettingsRelations = relations(
  branchReceiptSettings,
  ({ one }) => ({
    branch: one(branches, {
      fields: [branchReceiptSettings.branchId],
      references: [branches.id],
    }),
    business: one(businesses, {
      fields: [branchReceiptSettings.businessId],
      references: [businesses.id],
    }),
  }),
);

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
export type BranchOperatingHour = typeof branchOperatingHours.$inferSelect;
export type NewBranchOperatingHour = typeof branchOperatingHours.$inferInsert;
export type BranchScheduleSetting = typeof branchScheduleSettings.$inferSelect;
export type NewBranchScheduleSetting = typeof branchScheduleSettings.$inferInsert;
export type BranchClosedDay = typeof branchClosedDays.$inferSelect;
export type NewBranchClosedDay = typeof branchClosedDays.$inferInsert;
export type PaymentMethodDefinition = typeof paymentMethodDefinitions.$inferSelect;
export type NewPaymentMethodDefinition = typeof paymentMethodDefinitions.$inferInsert;
export type BranchPaymentMethod = typeof branchPaymentMethods.$inferSelect;
export type NewBranchPaymentMethod = typeof branchPaymentMethods.$inferInsert;
export type TaxRate = typeof taxRates.$inferSelect;
export type NewTaxRate = typeof taxRates.$inferInsert;
export type BranchTaxSetting = typeof branchTaxSettings.$inferSelect;
export type NewBranchTaxSetting = typeof branchTaxSettings.$inferInsert;
export type BranchReceiptSetting = typeof branchReceiptSettings.$inferSelect;
export type NewBranchReceiptSetting = typeof branchReceiptSettings.$inferInsert;
export type BusinessSettings = typeof businessSettings.$inferSelect;
