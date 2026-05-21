import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { businesses, branches } from "./business";
import { categories, optionValues, products, productVariants } from "./catalog";
import { users } from "./identity";

export const branchCategoryOverrides = pgTable(
  "branch_category_overrides",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    visible: boolean("visible"),
    position: integer("position"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    branchCategoryUnique: uniqueIndex("branch_category_overrides_unique").on(
      table.branchId,
      table.categoryId,
    ),
    businessIdx: index("branch_category_overrides_business_idx").on(table.businessId),
    branchIdx: index("branch_category_overrides_branch_idx").on(table.branchId),
  }),
);

export const branchProductOverrides = pgTable(
  "branch_product_overrides",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    available: boolean("available"),
    is86d: boolean("is_86d").notNull().default(false),
    eightySixedAt: timestamp("eighty_sixed_at", { withTimezone: true }),
    eightySixedByUserId: uuid("eighty_sixed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    eightySixedReason: text("eighty_sixed_reason"),
    featured: boolean("featured"),
    hidden: boolean("hidden"),
    availableDineIn: boolean("available_dine_in"),
    availableTakeaway: boolean("available_takeaway"),
    availableDelivery: boolean("available_delivery"),
    availableQr: boolean("available_qr"),
    availableOnline: boolean("available_online"),
    position: integer("position"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    branchProductUnique: uniqueIndex("branch_product_overrides_unique").on(
      table.branchId,
      table.productId,
    ),
    businessIdx: index("branch_product_overrides_business_idx").on(table.businessId),
    branchIdx: index("branch_product_overrides_branch_idx").on(table.branchId),
  }),
);

export const branchProductPriceOverrides = pgTable(
  "branch_product_price_overrides",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    branchVariantUnique: uniqueIndex("branch_product_price_overrides_unique").on(
      table.branchId,
      table.variantId,
    ),
    businessIdx: index("branch_product_price_overrides_business_idx").on(table.businessId),
    branchIdx: index("branch_product_price_overrides_branch_idx").on(table.branchId),
  }),
);

export const branchOptionValueOverrides = pgTable(
  "branch_option_value_overrides",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    optionValueId: uuid("option_value_id")
      .notNull()
      .references(() => optionValues.id, { onDelete: "cascade" }),
    available: boolean("available"),
    priceAddition: numeric("price_addition", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    branchOptionValueUnique: uniqueIndex("branch_option_value_overrides_unique").on(
      table.branchId,
      table.optionValueId,
    ),
    businessIdx: index("branch_option_value_overrides_business_idx").on(table.businessId),
    branchIdx: index("branch_option_value_overrides_branch_idx").on(table.branchId),
  }),
);

export const branchCategoryOverridesRelations = relations(
  branchCategoryOverrides,
  ({ one }) => ({
    business: one(businesses, {
      fields: [branchCategoryOverrides.businessId],
      references: [businesses.id],
    }),
    branch: one(branches, {
      fields: [branchCategoryOverrides.branchId],
      references: [branches.id],
    }),
    category: one(categories, {
      fields: [branchCategoryOverrides.categoryId],
      references: [categories.id],
    }),
  }),
);

export const branchProductOverridesRelations = relations(
  branchProductOverrides,
  ({ one }) => ({
    business: one(businesses, {
      fields: [branchProductOverrides.businessId],
      references: [businesses.id],
    }),
    branch: one(branches, {
      fields: [branchProductOverrides.branchId],
      references: [branches.id],
    }),
    product: one(products, {
      fields: [branchProductOverrides.productId],
      references: [products.id],
    }),
  }),
);

export const branchProductPriceOverridesRelations = relations(
  branchProductPriceOverrides,
  ({ one }) => ({
    business: one(businesses, {
      fields: [branchProductPriceOverrides.businessId],
      references: [businesses.id],
    }),
    branch: one(branches, {
      fields: [branchProductPriceOverrides.branchId],
      references: [branches.id],
    }),
    product: one(products, {
      fields: [branchProductPriceOverrides.productId],
      references: [products.id],
    }),
    variant: one(productVariants, {
      fields: [branchProductPriceOverrides.variantId],
      references: [productVariants.id],
    }),
  }),
);

export const branchOptionValueOverridesRelations = relations(
  branchOptionValueOverrides,
  ({ one }) => ({
    business: one(businesses, {
      fields: [branchOptionValueOverrides.businessId],
      references: [businesses.id],
    }),
    branch: one(branches, {
      fields: [branchOptionValueOverrides.branchId],
      references: [branches.id],
    }),
    optionValue: one(optionValues, {
      fields: [branchOptionValueOverrides.optionValueId],
      references: [optionValues.id],
    }),
  }),
);

export type BranchCategoryOverride = typeof branchCategoryOverrides.$inferSelect;
export type BranchProductOverride = typeof branchProductOverrides.$inferSelect;
export type BranchProductPriceOverride = typeof branchProductPriceOverrides.$inferSelect;
export type BranchOptionValueOverride = typeof branchOptionValueOverrides.$inferSelect;
