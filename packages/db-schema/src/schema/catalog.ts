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
import { businesses } from "./business";
import { orderItems } from "./ordering";

export const optionTypeEnum = pgEnum("option_type", [
  "single_select",
  "multi_select",
]);

export const productVariantKindEnum = pgEnum("product_variant_kind", [
  "size",
  "protein",
  "topping",
  "market",
  "custom",
]);

export const productVariantPricingModeEnum = pgEnum(
  "product_variant_pricing_mode",
  ["fixed", "variable_pos"],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    slug: text("slug"),
    description: text("description"),
    localizedNames: jsonb("localized_names")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    localizedDescriptions: jsonb("localized_descriptions")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    colorTag: text("color_tag"),
    position: integer("position").notNull().default(0),
    visible: boolean("visible").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    businessParentPositionIdx: index("categories_business_parent_position_idx").on(
      table.businessId,
      table.parentId,
      table.position,
    ),
    businessSlugUnique: uniqueIndex("categories_business_slug_unique")
      .on(table.businessId, table.slug)
      .where(sql`${table.slug} is not null and ${table.deletedAt} is null`),
    parentNotSelfCheck: check(
      "categories_parent_not_self_check",
      sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`,
    ),
  }),
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    image: text("image"),
    sku: text("sku"),
    itemCode: text("item_code"),
    colorTag: text("color_tag"),
    featured: boolean("featured").notNull().default(false),
    hidden: boolean("hidden").notNull().default(false),
    availableDineIn: boolean("available_dine_in").notNull().default(true),
    availableTakeaway: boolean("available_takeaway").notNull().default(true),
    availableDelivery: boolean("available_delivery").notNull().default(true),
    availableQr: boolean("available_qr").notNull().default(true),
    availableOnline: boolean("available_online").notNull().default(true),
    localizedNames: jsonb("localized_names")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    localizedDescriptions: jsonb("localized_descriptions")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    available: boolean("available").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    businessCategoryPositionIdx: index("products_business_category_position_idx").on(
      table.businessId,
      table.categoryId,
      table.position,
    ),
    businessSkuIdx: index("products_business_sku_idx").on(table.businessId, table.sku),
    businessItemCodeIdx: index("products_business_item_code_idx").on(
      table.businessId,
      table.itemCode,
    ),
  }),
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceOverride: numeric("price_override", { precision: 10, scale: 2 }),
    variantKind: productVariantKindEnum("variant_kind").notNull().default("custom"),
    pricingMode: productVariantPricingModeEnum("pricing_mode")
      .notNull()
      .default("fixed"),
    displayPriceLabel: text("display_price_label"),
    displayPriceMin: numeric("display_price_min", { precision: 10, scale: 2 }),
    displayPriceMax: numeric("display_price_max", { precision: 10, scale: 2 }),
    unitLabel: text("unit_label"),
    position: integer("position").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    available: boolean("available").notNull().default(true),
    optionMaxSelectionsOverrides: jsonb("option_max_selections_overrides")
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    productPositionIdx: index("product_variants_product_id_position_idx").on(
      table.productId,
      table.position,
    ),
    defaultVariantIdx: uniqueIndex("product_variants_one_default_idx")
      .on(table.productId)
      .where(sql`${table.isDefault} = true`),
  }),
);

export const menuLocaleSettings = pgTable("menu_locale_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  activeLocales: jsonb("active_locales")
    .$type<string[]>()
    .notNull()
    .default(sql`'["fr"]'::jsonb`),
  defaultLocale: varchar("default_locale", { length: 16 }).notNull().default("fr"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    altText: text("alt_text"),
    position: integer("position").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    productPositionUnique: uniqueIndex("product_images_product_position_unique").on(
      table.productId,
      table.position,
    ),
    productPrimaryUnique: uniqueIndex("product_images_one_primary_idx")
      .on(table.productId)
      .where(sql`${table.isPrimary} = true`),
    businessIdx: index("product_images_business_idx").on(table.businessId),
    productIdx: index("product_images_product_idx").on(table.productId),
  }),
);

export const productOptions = pgTable(
  "product_options",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: optionTypeEnum("type").notNull().default("single_select"),
    required: boolean("required").notNull().default(false),
    minSelect: integer("min_select").notNull().default(0),
    maxSelect: integer("max_select"),
    position: integer("position").notNull().default(0),
    available: boolean("available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    productPositionIdx: index("product_options_product_id_position_idx").on(
      table.productId,
      table.position,
    ),
  }),
);

export const optionValues = pgTable(
  "option_values",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    optionId: uuid("option_id")
      .notNull()
      .references(() => productOptions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceAddition: numeric("price_addition", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    position: integer("position").notNull().default(0),
    available: boolean("available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    optionPositionIdx: index("option_values_option_id_position_idx").on(
      table.optionId,
      table.position,
    ),
  }),
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  business: one(businesses, {
    fields: [categories.businessId],
    references: [businesses.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "category_parent",
  }),
  children: many(categories, { relationName: "category_parent" }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  business: one(businesses, {
    fields: [products.businessId],
    references: [businesses.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
  images: many(productImages),
  options: many(productOptions),
  orderItems: many(orderItems),
}));

export const productVariantsRelations = relations(
  productVariants,
  ({ one }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
  }),
);

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
  business: one(businesses, {
    fields: [productImages.businessId],
    references: [businesses.id],
  }),
}));

export const productOptionsRelations = relations(
  productOptions,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productOptions.productId],
      references: [products.id],
    }),
    values: many(optionValues),
  }),
);

export const optionValuesRelations = relations(optionValues, ({ one }) => ({
  option: one(productOptions, {
    fields: [optionValues.optionId],
    references: [productOptions.id],
  }),
}));

export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type MenuLocaleSettings = typeof menuLocaleSettings.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type NewProduct = typeof products.$inferInsert;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type NewProductImage = typeof productImages.$inferInsert;
export type ProductOption = typeof productOptions.$inferSelect;
export type OptionValue = typeof optionValues.$inferSelect;
