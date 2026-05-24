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
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { businesses } from "./business";
import {
  dietaryTags,
  menuImportJobStatusEnum,
  modifierValueTemplates,
} from "./catalog";
import { users } from "./identity";

export const unitDimensionEnum = pgEnum("unit_dimension", [
  "mass",
  "volume",
  "count",
]);

export const ingredientCategoryEnum = pgEnum("ingredient_category", [
  "meat",
  "dairy",
  "vegetable",
  "spice",
  "dry_good",
  "beverage",
  "alcohol",
  "packaging",
]);

export const unitsOfMeasure = pgTable("units_of_measure", {
  code: varchar("code", { length: 32 }).primaryKey(),
  dimension: unitDimensionEnum("dimension").notNull(),
  factorToBase: numeric("factor_to_base", { precision: 18, scale: 6 }).notNull(),
});

export const ingredients = pgTable(
  "ingredients",
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
    category: ingredientCategoryEnum("category").notNull().default("dry_good"),
    stockUom: varchar("stock_uom", { length: 32 })
      .notNull()
      .references(() => unitsOfMeasure.code, { onDelete: "restrict" }),
    currentCostPerUom: numeric("current_cost_per_uom", {
      precision: 12,
      scale: 4,
    }),
    trackedInStock: boolean("tracked_in_stock").notNull().default(true),
    supplierId: uuid("supplier_id"),
    storageLocation: text("storage_location"),
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
    businessPositionIdx: index("ingredients_business_position_idx").on(
      table.businessId,
      table.deletedAt,
      table.position,
    ),
    businessNameIdx: index("ingredients_business_name_idx").on(
      table.businessId,
      table.name,
    ),
    currentCostNonNegativeCheck: check(
      "ingredients_current_cost_non_negative",
      sql`${table.currentCostPerUom} is null or ${table.currentCostPerUom} >= 0`,
    ),
  }),
);

export const ingredientUnitConversions = pgTable(
  "ingredient_unit_conversions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    altUom: varchar("alt_uom", { length: 32 })
      .notNull()
      .references(() => unitsOfMeasure.code, { onDelete: "restrict" }),
    qtyInStockUom: numeric("qty_in_stock_uom", {
      precision: 18,
      scale: 4,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    ingredientAltUomUnique: uniqueIndex(
      "ingredient_unit_conversions_ingredient_alt_uom_unique",
    ).on(table.ingredientId, table.altUom),
    businessIdx: index("ingredient_unit_conversions_business_idx").on(
      table.businessId,
    ),
    ingredientIdx: index("ingredient_unit_conversions_ingredient_idx").on(
      table.ingredientId,
    ),
    qtyPositiveCheck: check(
      "ingredient_unit_conversions_qty_positive",
      sql`${table.qtyInStockUom} > 0`,
    ),
  }),
);

export const ingredientTags = pgTable(
  "ingredient_tags",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => dietaryTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.ingredientId, table.tagId] }),
    businessIdx: index("ingredient_tags_business_idx").on(table.businessId),
    tagIdx: index("ingredient_tags_tag_idx").on(table.tagId),
  }),
);

export const modifierValueIngredientDeltas = pgTable(
  "modifier_value_ingredient_deltas",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    modifierValueTemplateId: uuid("modifier_value_template_id")
      .notNull()
      .references(() => modifierValueTemplates.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "restrict" }),
    quantityDelta: numeric("quantity_delta", { precision: 18, scale: 4 }).notNull(),
    uom: varchar("uom", { length: 32 })
      .notNull()
      .references(() => unitsOfMeasure.code, { onDelete: "restrict" }),
    quantityIsCooked: boolean("quantity_is_cooked").notNull().default(false),
    yieldPct: numeric("yield_pct", { precision: 7, scale: 4 }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessIdx: index("modifier_value_ingredient_deltas_business_idx").on(
      table.businessId,
    ),
    valuePositionIdx: index("modifier_value_ingredient_deltas_value_position_idx").on(
      table.modifierValueTemplateId,
      table.position,
    ),
    ingredientIdx: index("modifier_value_ingredient_deltas_ingredient_idx").on(
      table.ingredientId,
    ),
    quantityNonZeroCheck: check(
      "modifier_value_ingredient_deltas_quantity_nonzero",
      sql`${table.quantityDelta} <> 0`,
    ),
    yieldPctCheck: check(
      "modifier_value_ingredient_deltas_yield_pct_check",
      sql`${table.yieldPct} is null or (${table.yieldPct} > 0 and ${table.yieldPct} <= 100)`,
    ),
  }),
);

export const ingredientImportJobs = pgTable(
  "ingredient_import_jobs",
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
    businessStatusIdx: index("ingredient_import_jobs_business_status_idx").on(
      table.businessId,
      table.status,
      table.createdAt,
    ),
    fileTypeCheck: check(
      "ingredient_import_jobs_file_type_check",
      sql`${table.fileType} in ('csv', 'xlsx')`,
    ),
    countsNonnegativeCheck: check(
      "ingredient_import_jobs_counts_nonnegative_check",
      sql`${table.rowCount} >= 0 and ${table.errorCount} >= 0 and ${table.warningCount} >= 0`,
    ),
  }),
);

export const unitsOfMeasureRelations = relations(unitsOfMeasure, ({ many }) => ({
  ingredients: many(ingredients),
}));

export const ingredientsRelations = relations(ingredients, ({ one, many }) => ({
  business: one(businesses, {
    fields: [ingredients.businessId],
    references: [businesses.id],
  }),
  unit: one(unitsOfMeasure, {
    fields: [ingredients.stockUom],
    references: [unitsOfMeasure.code],
  }),
  conversions: many(ingredientUnitConversions),
  tags: many(ingredientTags),
}));

export const ingredientUnitConversionsRelations = relations(
  ingredientUnitConversions,
  ({ one }) => ({
    business: one(businesses, {
      fields: [ingredientUnitConversions.businessId],
      references: [businesses.id],
    }),
    ingredient: one(ingredients, {
      fields: [ingredientUnitConversions.ingredientId],
      references: [ingredients.id],
    }),
    unit: one(unitsOfMeasure, {
      fields: [ingredientUnitConversions.altUom],
      references: [unitsOfMeasure.code],
    }),
  }),
);

export const ingredientTagsRelations = relations(ingredientTags, ({ one }) => ({
  ingredient: one(ingredients, {
    fields: [ingredientTags.ingredientId],
    references: [ingredients.id],
  }),
  tag: one(dietaryTags, {
    fields: [ingredientTags.tagId],
    references: [dietaryTags.id],
  }),
}));

export const modifierValueIngredientDeltasRelations = relations(
  modifierValueIngredientDeltas,
  ({ one }) => ({
    valueTemplate: one(modifierValueTemplates, {
      fields: [modifierValueIngredientDeltas.modifierValueTemplateId],
      references: [modifierValueTemplates.id],
    }),
    ingredient: one(ingredients, {
      fields: [modifierValueIngredientDeltas.ingredientId],
      references: [ingredients.id],
    }),
    unit: one(unitsOfMeasure, {
      fields: [modifierValueIngredientDeltas.uom],
      references: [unitsOfMeasure.code],
    }),
  }),
);

export const ingredientImportJobsRelations = relations(ingredientImportJobs, ({ one }) => ({
  business: one(businesses, {
    fields: [ingredientImportJobs.businessId],
    references: [businesses.id],
  }),
  creator: one(users, {
    fields: [ingredientImportJobs.createdBy],
    references: [users.id],
  }),
}));

export type UnitOfMeasure = typeof unitsOfMeasure.$inferSelect;
export type NewUnitOfMeasure = typeof unitsOfMeasure.$inferInsert;
export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;
export type IngredientUnitConversion =
  typeof ingredientUnitConversions.$inferSelect;
export type NewIngredientUnitConversion =
  typeof ingredientUnitConversions.$inferInsert;
export type IngredientTag = typeof ingredientTags.$inferSelect;
export type NewIngredientTag = typeof ingredientTags.$inferInsert;
export type ModifierValueIngredientDelta =
  typeof modifierValueIngredientDeltas.$inferSelect;
export type NewModifierValueIngredientDelta =
  typeof modifierValueIngredientDeltas.$inferInsert;
export type IngredientImportJob = typeof ingredientImportJobs.$inferSelect;
export type NewIngredientImportJob = typeof ingredientImportJobs.$inferInsert;
