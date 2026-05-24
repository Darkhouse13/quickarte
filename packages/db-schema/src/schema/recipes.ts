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
import { ingredients, unitsOfMeasure } from "./ingredients";
import { productVariants } from "./catalog";

export const recipeComponentTypeEnum = pgEnum("recipe_component_type", [
  "ingredient",
  "sub_recipe",
]);

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    localizedNames: jsonb("localized_names")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    yieldQty: numeric("yield_qty", { precision: 18, scale: 4 })
      .notNull()
      .default("1"),
    yieldUom: varchar("yield_uom", { length: 32 }).references(
      () => unitsOfMeasure.code,
      { onDelete: "restrict" },
    ),
    prepNotes: text("prep_notes"),
    photoUrl: text("photo_url"),
    computedCost: numeric("computed_cost", { precision: 14, scale: 4 })
      .notNull()
      .default("0"),
    costIsComplete: boolean("cost_is_complete").notNull().default(true),
    foodCostPct: numeric("food_cost_pct", { precision: 9, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    businessIdx: index("recipes_business_idx").on(
      table.businessId,
      table.deletedAt,
      table.name,
    ),
    variantUnique: uniqueIndex("recipes_one_active_per_variant_idx")
      .on(table.variantId)
      .where(sql`${table.variantId} is not null and ${table.deletedAt} is null`),
    yieldQtyPositiveCheck: check(
      "recipes_yield_qty_positive",
      sql`${table.yieldQty} > 0`,
    ),
    subRecipeYieldUomRequiredCheck: check(
      "recipes_sub_recipe_yield_uom_required",
      sql`${table.variantId} is not null or ${table.yieldUom} is not null`,
    ),
    computedCostNonNegativeCheck: check(
      "recipes_computed_cost_non_negative",
      sql`${table.computedCost} >= 0`,
    ),
    foodCostPctNonNegativeCheck: check(
      "recipes_food_cost_pct_non_negative",
      sql`${table.foodCostPct} is null or ${table.foodCostPct} >= 0`,
    ),
  }),
);

export const recipeLines = pgTable(
  "recipe_lines",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    componentType: recipeComponentTypeEnum("component_type").notNull(),
    ingredientId: uuid("ingredient_id").references(() => ingredients.id, {
      onDelete: "restrict",
    }),
    subRecipeId: uuid("sub_recipe_id").references(() => recipes.id, {
      onDelete: "restrict",
    }),
    quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull(),
    uom: varchar("uom", { length: 32 })
      .notNull()
      .references(() => unitsOfMeasure.code, { onDelete: "restrict" }),
    yieldPct: numeric("yield_pct", { precision: 7, scale: 4 }),
    quantityIsCooked: boolean("quantity_is_cooked").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    recipePositionIdx: index("recipe_lines_recipe_position_idx").on(
      table.recipeId,
      table.position,
    ),
    businessIdx: index("recipe_lines_business_idx").on(table.businessId),
    ingredientIdx: index("recipe_lines_ingredient_idx").on(table.ingredientId),
    subRecipeIdx: index("recipe_lines_sub_recipe_idx").on(table.subRecipeId),
    quantityPositiveCheck: check(
      "recipe_lines_quantity_positive",
      sql`${table.quantity} > 0`,
    ),
    yieldPctBoundsCheck: check(
      "recipe_lines_yield_pct_bounds",
      sql`${table.yieldPct} is null or (${table.yieldPct} > 0 and ${table.yieldPct} <= 100)`,
    ),
    componentXorCheck: check(
      "recipe_lines_component_xor",
      sql`(
        ${table.componentType} = 'ingredient'
        and ${table.ingredientId} is not null
        and ${table.subRecipeId} is null
      ) or (
        ${table.componentType} = 'sub_recipe'
        and ${table.subRecipeId} is not null
        and ${table.ingredientId} is null
      )`,
    ),
  }),
);

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  business: one(businesses, {
    fields: [recipes.businessId],
    references: [businesses.id],
  }),
  variant: one(productVariants, {
    fields: [recipes.variantId],
    references: [productVariants.id],
  }),
  lines: many(recipeLines, { relationName: "recipe_lines" }),
  usedAsSubRecipeLines: many(recipeLines, {
    relationName: "sub_recipe_lines",
  }),
}));

export const recipeLinesRelations = relations(recipeLines, ({ one }) => ({
  business: one(businesses, {
    fields: [recipeLines.businessId],
    references: [businesses.id],
  }),
  recipe: one(recipes, {
    fields: [recipeLines.recipeId],
    references: [recipes.id],
    relationName: "recipe_lines",
  }),
  ingredient: one(ingredients, {
    fields: [recipeLines.ingredientId],
    references: [ingredients.id],
  }),
  subRecipe: one(recipes, {
    fields: [recipeLines.subRecipeId],
    references: [recipes.id],
    relationName: "sub_recipe_lines",
  }),
}));

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeLine = typeof recipeLines.$inferSelect;
export type NewRecipeLine = typeof recipeLines.$inferInsert;
