import {
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { branches, businesses } from "./business";
import { ingredients } from "./ingredients";
import { users } from "./identity";

export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "sale_deduction",
  "adjustment",
  "receipt",
  "transfer_in",
  "transfer_out",
  "count_correction",
  "batch_production",
  "batch_consumption",
]);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "restrict" }),
    quantityDelta: numeric("quantity_delta", { precision: 18, scale: 4 }).notNull(),
    movementType: stockMovementTypeEnum("movement_type").notNull(),
    reason: text("reason"),
    referenceType: varchar("reference_type", { length: 64 }),
    referenceId: text("reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => ({
    businessBranchIdx: index("stock_movements_business_branch_idx").on(
      table.businessId,
      table.branchId,
      table.createdAt,
    ),
    ingredientIdx: index("stock_movements_ingredient_idx").on(table.ingredientId),
    referenceIdx: index("stock_movements_reference_idx").on(
      table.businessId,
      table.referenceType,
      table.referenceId,
    ),
    quantityNonZeroCheck: check(
      "stock_movements_quantity_delta_non_zero",
      sql`${table.quantityDelta} <> 0`,
    ),
  }),
);

export const stockLevels = pgTable(
  "stock_levels",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    currentQty: numeric("current_qty", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.businessId, table.branchId, table.ingredientId] }),
    branchIdx: index("stock_levels_branch_idx").on(table.businessId, table.branchId),
    ingredientIdx: index("stock_levels_ingredient_idx").on(table.ingredientId),
  }),
);

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  business: one(businesses, {
    fields: [stockMovements.businessId],
    references: [businesses.id],
  }),
  branch: one(branches, {
    fields: [stockMovements.branchId],
    references: [branches.id],
  }),
  ingredient: one(ingredients, {
    fields: [stockMovements.ingredientId],
    references: [ingredients.id],
  }),
  creator: one(users, {
    fields: [stockMovements.createdBy],
    references: [users.id],
  }),
}));

export const stockLevelsRelations = relations(stockLevels, ({ one }) => ({
  business: one(businesses, {
    fields: [stockLevels.businessId],
    references: [businesses.id],
  }),
  branch: one(branches, {
    fields: [stockLevels.branchId],
    references: [branches.id],
  }),
  ingredient: one(ingredients, {
    fields: [stockLevels.ingredientId],
    references: [ingredients.id],
  }),
}));

export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
export type StockLevel = typeof stockLevels.$inferSelect;
export type NewStockLevel = typeof stockLevels.$inferInsert;
