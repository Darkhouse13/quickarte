import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { businesses } from "./business";
import { users } from "./identity";
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

export const modifierAttachScopeEnum = pgEnum("modifier_attach_scope", [
  "product",
  "category",
]);

export const dietaryTagKindEnum = pgEnum("dietary_tag_kind", [
  "dietary",
  "allergen",
]);

export const menuImportJobStatusEnum = pgEnum("menu_import_job_status", [
  "pending_review",
  "committed",
  "failed",
]);

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
    spiceLevel: smallint("spice_level"),
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

export const dietaryTags = pgTable(
  "dietary_tags",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: dietaryTagKindEnum("kind").notNull(),
    code: varchar("code", { length: 96 }).notNull(),
    localizedLabels: jsonb("localized_labels")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    position: integer("position").notNull().default(0),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    businessCodeUnique: uniqueIndex("dietary_tags_business_code_unique")
      .on(table.businessId, table.code)
      .where(sql`${table.deletedAt} is null`),
    businessPositionIdx: index("dietary_tags_business_position_idx")
      .on(table.businessId, table.kind, table.position)
      .where(sql`${table.deletedAt} is null`),
    codeFormatCheck: check(
      "dietary_tags_code_format_check",
      sql`${table.code} ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'`,
    ),
  }),
);

export const productTags = pgTable(
  "product_tags",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => dietaryTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.productId, table.tagId] }),
    businessIdx: index("product_tags_business_idx").on(table.businessId),
    tagIdx: index("product_tags_tag_idx").on(table.tagId),
  }),
);

export const productAvailabilityWindows = pgTable(
  "product_availability_windows",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(),
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessIdx: index("product_availability_windows_business_idx").on(table.businessId),
    productIdx: index("product_availability_windows_product_idx").on(
      table.productId,
      table.dayOfWeek,
    ),
    dayCheck: check(
      "product_availability_windows_day_check",
      sql`${table.dayOfWeek} >= 0 and ${table.dayOfWeek} <= 6`,
    ),
    startMinuteCheck: check(
      "product_availability_windows_start_minute_check",
      sql`${table.startMinute} >= 0 and ${table.startMinute} <= 1439`,
    ),
    endMinuteCheck: check(
      "product_availability_windows_end_minute_check",
      sql`${table.endMinute} >= 0 and ${table.endMinute} <= 1439`,
    ),
  }),
);

export const menuImportJobs = pgTable(
  "menu_import_jobs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    status: menuImportJobStatusEnum("status").notNull().default("pending_review"),
    originalFilename: text("original_filename").notNull(),
    fileType: varchar("file_type", { length: 16 }).notNull(),
    parsedRows: jsonb("parsed_rows")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    previewReport: jsonb("preview_report")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    rowCount: integer("row_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    warningCount: integer("warning_count").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessStatusIdx: index("menu_import_jobs_business_status_idx").on(
      table.businessId,
      table.status,
      table.createdAt,
    ),
    fileTypeCheck: check(
      "menu_import_jobs_file_type_check",
      sql`${table.fileType} in ('csv', 'xlsx')`,
    ),
    countsNonnegativeCheck: check(
      "menu_import_jobs_counts_nonnegative_check",
      sql`${table.rowCount} >= 0 and ${table.errorCount} >= 0 and ${table.warningCount} >= 0`,
    ),
  }),
);

export const modifierGroupTemplates = pgTable(
  "modifier_group_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    localizedNames: jsonb("localized_names")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    type: optionTypeEnum("type").notNull().default("single_select"),
    required: boolean("required").notNull().default(false),
    minSelect: integer("min_select").notNull().default(0),
    maxSelect: integer("max_select"),
    freeQuantity: integer("free_quantity").notNull().default(0),
    extraPrice: numeric("extra_price", { precision: 10, scale: 2 }),
    attachScope: modifierAttachScopeEnum("attach_scope").notNull().default("product"),
    reusable: boolean("reusable").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    businessIdx: index("modifier_group_templates_business_idx").on(
      table.businessId,
      table.deletedAt,
    ),
    selectBoundsCheck: check(
      "modifier_group_templates_select_bounds_check",
      sql`${table.minSelect} >= 0 and (${table.maxSelect} is null or ${table.maxSelect} >= ${table.minSelect})`,
    ),
    freeQuantityCheck: check(
      "modifier_group_templates_free_quantity_check",
      sql`${table.freeQuantity} >= 0`,
    ),
  }),
);

export const modifierValueTemplates = pgTable(
  "modifier_value_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    groupTemplateId: uuid("group_template_id")
      .notNull()
      .references(() => modifierGroupTemplates.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    localizedNames: jsonb("localized_names")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    priceAddition: numeric("price_addition", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    position: integer("position").notNull().default(0),
    available: boolean("available").notNull().default(true),
    recipeHookKey: text("recipe_hook_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    groupPositionIdx: index("modifier_value_templates_group_position_idx").on(
      table.groupTemplateId,
      table.position,
    ),
    businessIdx: index("modifier_value_templates_business_idx").on(table.businessId),
  }),
);

export const categoryModifierGroups = pgTable(
  "category_modifier_groups",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    groupTemplateId: uuid("group_template_id")
      .notNull()
      .references(() => modifierGroupTemplates.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.categoryId, table.groupTemplateId] }),
    businessIdx: index("category_modifier_groups_business_idx").on(table.businessId),
    categoryPositionIdx: index("category_modifier_groups_category_position_idx").on(
      table.categoryId,
      table.position,
    ),
  }),
);

export const productOptions = pgTable(
  "product_options",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => modifierGroupTemplates.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    localizedNames: jsonb("localized_names")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    type: optionTypeEnum("type").notNull().default("single_select"),
    required: boolean("required").notNull().default(false),
    minSelect: integer("min_select").notNull().default(0),
    maxSelect: integer("max_select"),
    freeQuantity: integer("free_quantity").notNull().default(0),
    extraPrice: numeric("extra_price", { precision: 10, scale: 2 }),
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
    templateValueId: uuid("template_value_id").references(() => modifierValueTemplates.id, {
      onDelete: "set null",
    }),
    localizedNames: jsonb("localized_names")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
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
  categoryModifierGroups: many(categoryModifierGroups),
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
  tags: many(productTags),
  availabilityWindows: many(productAvailabilityWindows),
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

export const dietaryTagsRelations = relations(dietaryTags, ({ one, many }) => ({
  business: one(businesses, {
    fields: [dietaryTags.businessId],
    references: [businesses.id],
  }),
  productTags: many(productTags),
}));

export const productTagsRelations = relations(productTags, ({ one }) => ({
  product: one(products, {
    fields: [productTags.productId],
    references: [products.id],
  }),
  tag: one(dietaryTags, {
    fields: [productTags.tagId],
    references: [dietaryTags.id],
  }),
}));

export const productAvailabilityWindowsRelations = relations(
  productAvailabilityWindows,
  ({ one }) => ({
    product: one(products, {
      fields: [productAvailabilityWindows.productId],
      references: [products.id],
    }),
    business: one(businesses, {
      fields: [productAvailabilityWindows.businessId],
      references: [businesses.id],
    }),
  }),
);

export const menuImportJobsRelations = relations(menuImportJobs, ({ one }) => ({
  business: one(businesses, {
    fields: [menuImportJobs.businessId],
    references: [businesses.id],
  }),
  creator: one(users, {
    fields: [menuImportJobs.createdBy],
    references: [users.id],
  }),
}));

export const modifierGroupTemplatesRelations = relations(
  modifierGroupTemplates,
  ({ one, many }) => ({
    business: one(businesses, {
      fields: [modifierGroupTemplates.businessId],
      references: [businesses.id],
    }),
    values: many(modifierValueTemplates),
    categoryAttachments: many(categoryModifierGroups),
  }),
);

export const modifierValueTemplatesRelations = relations(
  modifierValueTemplates,
  ({ one }) => ({
    group: one(modifierGroupTemplates, {
      fields: [modifierValueTemplates.groupTemplateId],
      references: [modifierGroupTemplates.id],
    }),
  }),
);

export const categoryModifierGroupsRelations = relations(
  categoryModifierGroups,
  ({ one }) => ({
    category: one(categories, {
      fields: [categoryModifierGroups.categoryId],
      references: [categories.id],
    }),
    group: one(modifierGroupTemplates, {
      fields: [categoryModifierGroups.groupTemplateId],
      references: [modifierGroupTemplates.id],
    }),
  }),
);

export const productOptionsRelations = relations(
  productOptions,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productOptions.productId],
      references: [products.id],
    }),
    values: many(optionValues),
    template: one(modifierGroupTemplates, {
      fields: [productOptions.templateId],
      references: [modifierGroupTemplates.id],
    }),
  }),
);

export const optionValuesRelations = relations(optionValues, ({ one }) => ({
  option: one(productOptions, {
    fields: [optionValues.optionId],
    references: [productOptions.id],
  }),
  templateValue: one(modifierValueTemplates, {
    fields: [optionValues.templateValueId],
    references: [modifierValueTemplates.id],
  }),
}));

export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type MenuLocaleSettings = typeof menuLocaleSettings.$inferSelect;
export type DietaryTag = typeof dietaryTags.$inferSelect;
export type ProductTag = typeof productTags.$inferSelect;
export type ProductAvailabilityWindow = typeof productAvailabilityWindows.$inferSelect;
export type MenuImportJob = typeof menuImportJobs.$inferSelect;
export type ModifierGroupTemplate = typeof modifierGroupTemplates.$inferSelect;
export type ModifierValueTemplate = typeof modifierValueTemplates.$inferSelect;
export type CategoryModifierGroup = typeof categoryModifierGroups.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type NewProduct = typeof products.$inferInsert;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type NewProductImage = typeof productImages.$inferInsert;
export type NewDietaryTag = typeof dietaryTags.$inferInsert;
export type NewProductTag = typeof productTags.$inferInsert;
export type NewProductAvailabilityWindow = typeof productAvailabilityWindows.$inferInsert;
export type NewMenuImportJob = typeof menuImportJobs.$inferInsert;
export type NewModifierGroupTemplate = typeof modifierGroupTemplates.$inferInsert;
export type NewModifierValueTemplate = typeof modifierValueTemplates.$inferInsert;
export type ProductOption = typeof productOptions.$inferSelect;
export type OptionValue = typeof optionValues.$inferSelect;
