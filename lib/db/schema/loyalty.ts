import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { businesses } from "./business";
import { orders } from "./ordering";

export const accrualTypeEnum = pgEnum("accrual_type", [
  "per_visit",
  "per_euro",
]);

export const loyaltyTransactionTypeEnum = pgEnum("loyalty_transaction_type", [
  "earn",
  "redeem",
  "adjust",
]);

export const loyaltySourceEnum = pgEnum("loyalty_source", [
  "online_order",
  "manual_in_person",
  "admin_adjust",
]);

export const loyaltyPrograms = pgTable("loyalty_programs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  businessId: uuid("business_id")
    .notNull()
    .unique()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name"),
  accrualType: accrualTypeEnum("accrual_type").notNull().default("per_visit"),
  accrualRate: numeric("accrual_rate", { precision: 10, scale: 2 })
    .notNull()
    .default("1"),
  rewardThreshold: numeric("reward_threshold", { precision: 10, scale: 2 })
    .notNull(),
  rewardDescription: text("reward_description").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const loyaltyCustomers = pgTable(
  "loyalty_customers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    name: text("name"),
    balance: numeric("balance", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    lifetimeEarned: numeric("lifetime_earned", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    lifetimeRedeemed: integer("lifetime_redeemed").notNull().default(0),
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessPhoneUnique: unique("loyalty_customers_business_phone_unique").on(
      table.businessId,
      table.phone,
    ),
    businessBalanceIdx: index("loyalty_customers_business_balance_idx").on(
      table.businessId,
      table.balance,
    ),
  }),
);

export const loyaltyTransactions = pgTable(
  "loyalty_transactions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => loyaltyCustomers.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    type: loyaltyTransactionTypeEnum("type").notNull(),
    delta: numeric("delta", { precision: 10, scale: 2 }).notNull(),
    source: loyaltySourceEnum("source").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    customerIdx: index("loyalty_transactions_customer_id_idx").on(
      table.customerId,
    ),
    orderIdx: index("loyalty_transactions_order_id_idx").on(table.orderId),
  }),
);

export const loyaltyProgramsRelations = relations(
  loyaltyPrograms,
  ({ one }) => ({
    business: one(businesses, {
      fields: [loyaltyPrograms.businessId],
      references: [businesses.id],
    }),
  }),
);

export const loyaltyCustomersRelations = relations(
  loyaltyCustomers,
  ({ one, many }) => ({
    business: one(businesses, {
      fields: [loyaltyCustomers.businessId],
      references: [businesses.id],
    }),
    transactions: many(loyaltyTransactions),
  }),
);

export const loyaltyTransactionsRelations = relations(
  loyaltyTransactions,
  ({ one }) => ({
    business: one(businesses, {
      fields: [loyaltyTransactions.businessId],
      references: [businesses.id],
    }),
    customer: one(loyaltyCustomers, {
      fields: [loyaltyTransactions.customerId],
      references: [loyaltyCustomers.id],
    }),
    order: one(orders, {
      fields: [loyaltyTransactions.orderId],
      references: [orders.id],
    }),
  }),
);

export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type NewLoyaltyProgram = typeof loyaltyPrograms.$inferInsert;
export type LoyaltyCustomer = typeof loyaltyCustomers.$inferSelect;
export type NewLoyaltyCustomer = typeof loyaltyCustomers.$inferInsert;
export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type NewLoyaltyTransaction = typeof loyaltyTransactions.$inferInsert;
