import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { businesses } from "./business";
import { products } from "./catalog";
import { orders } from "./ordering";
import { users } from "./identity";

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

export const loyaltyTypeEnum = pgEnum("loyalty_type", [
  "points",
  "stamp",
  "credits",
]);

export const creditTransactionSourceEnum = pgEnum("credit_transaction_source", [
  "order_spend",
  "google_review",
  "manual_grant",
  "redemption",
  "manual_adjustment",
]);

export const loyaltyPrograms = pgTable("loyalty_programs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  businessId: uuid("business_id")
    .notNull()
    .unique()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name"),
  loyaltyType: loyaltyTypeEnum("loyalty_type").notNull().default("points"),
  accrualType: accrualTypeEnum("accrual_type").notNull().default("per_visit"),
  accrualRate: numeric("accrual_rate", { precision: 10, scale: 2 })
    .notNull()
    .default("1"),
  rewardThreshold: numeric("reward_threshold", { precision: 10, scale: 2 })
    .notNull(),
  rewardDescription: text("reward_description").notNull(),
  creditLabel: text("credit_label").notNull().default("Crédits"),
  accrualPerMad: numeric("accrual_per_mad", { precision: 10, scale: 4 })
    .notNull()
    .default("1.0000"),
  minOrderForAccrualMad: numeric("min_order_for_accrual_mad", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("0"),
  reviewRewardEnabled: boolean("review_reward_enabled")
    .notNull()
    .default(false),
  creditsPerReview: integer("credits_per_review").notNull().default(0),
  reviewMaxAgeDays: integer("review_max_age_days").notNull().default(30),
  redemptionEnabled: boolean("redemption_enabled").notNull().default(true),
  minBalanceToRedeem: integer("min_balance_to_redeem").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const loyaltyMembers = pgTable(
  "loyalty_members",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerPhoneNormalized: text("customer_phone_normalized").notNull(),
    balance: integer("balance").notNull().default(0),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessPhoneUnique: unique("loyalty_members_business_phone_unique").on(
      table.businessId,
      table.customerPhoneNormalized,
    ),
    businessBalanceIdx: index("loyalty_members_business_balance_idx").on(
      table.businessId,
      table.balance,
    ),
  }),
);

export const redemptionListings = pgTable(
  "redemption_listings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    creditPrice: integer("credit_price").notNull(),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessProductUnique: unique("redemption_listings_business_product_unique").on(
      table.businessId,
      table.productId,
    ),
    businessActivePositionIdx: index(
      "redemption_listings_business_active_position_idx",
    ).on(table.businessId, table.active, table.position),
    positiveCreditPrice: sql`CHECK (${table.creditPrice} > 0)`,
  }),
);

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerPhoneNormalized: text("customer_phone_normalized").notNull(),
    amount: integer("amount").notNull(),
    source: creditTransactionSourceEnum("source").notNull(),
    sourceRef: text("source_ref"),
    description: text("description"),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    systemSourceUnique: uniqueIndex(
      "credit_transactions_system_source_unique",
    )
      .on(table.businessId, table.source, table.sourceRef)
      .where(sql`${table.source} IN ('order_spend', 'google_review', 'redemption')`),
    customerCreatedIdx: index("credit_transactions_customer_created_idx").on(
      table.businessId,
      table.customerPhoneNormalized,
      table.createdAt,
    ),
  }),
);

export const googleReviewGrants = pgTable(
  "google_review_grants",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerPhoneNormalized: text("customer_phone_normalized").notNull(),
    googleReviewName: text("google_review_name").notNull(),
    googleAuthorDisplayName: text("google_author_display_name").notNull(),
    googleReviewPublishTime: timestamp("google_review_publish_time", {
      withTimezone: true,
    }).notNull(),
    googleReviewRating: integer("google_review_rating"),
    creditTransactionId: uuid("credit_transaction_id")
      .notNull()
      .references(() => creditTransactions.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessReviewUnique: unique("google_review_grants_business_review_unique").on(
      table.businessId,
      table.googleReviewName,
    ),
    customerCreatedIdx: index("google_review_grants_customer_created_idx").on(
      table.businessId,
      table.customerPhoneNormalized,
      table.createdAt,
    ),
  }),
);

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

export const loyaltyMembersRelations = relations(
  loyaltyMembers,
  ({ one, many }) => ({
    business: one(businesses, {
      fields: [loyaltyMembers.businessId],
      references: [businesses.id],
    }),
    creditTransactions: many(creditTransactions),
  }),
);

export const redemptionListingsRelations = relations(
  redemptionListings,
  ({ one }) => ({
    business: one(businesses, {
      fields: [redemptionListings.businessId],
      references: [businesses.id],
    }),
    product: one(products, {
      fields: [redemptionListings.productId],
      references: [products.id],
    }),
  }),
);

export const creditTransactionsRelations = relations(
  creditTransactions,
  ({ one }) => ({
    business: one(businesses, {
      fields: [creditTransactions.businessId],
      references: [businesses.id],
    }),
    actor: one(users, {
      fields: [creditTransactions.actorUserId],
      references: [users.id],
    }),
    member: one(loyaltyMembers, {
      fields: [
        creditTransactions.businessId,
        creditTransactions.customerPhoneNormalized,
      ],
      references: [
        loyaltyMembers.businessId,
        loyaltyMembers.customerPhoneNormalized,
      ],
    }),
  }),
);

export const googleReviewGrantsRelations = relations(
  googleReviewGrants,
  ({ one }) => ({
    business: one(businesses, {
      fields: [googleReviewGrants.businessId],
      references: [businesses.id],
    }),
    creditTransaction: one(creditTransactions, {
      fields: [googleReviewGrants.creditTransactionId],
      references: [creditTransactions.id],
    }),
  }),
);

export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type NewLoyaltyProgram = typeof loyaltyPrograms.$inferInsert;
export type LoyaltyCustomer = typeof loyaltyCustomers.$inferSelect;
export type NewLoyaltyCustomer = typeof loyaltyCustomers.$inferInsert;
export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type NewLoyaltyTransaction = typeof loyaltyTransactions.$inferInsert;
export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type NewLoyaltyMember = typeof loyaltyMembers.$inferInsert;
export type RedemptionListing = typeof redemptionListings.$inferSelect;
export type NewRedemptionListing = typeof redemptionListings.$inferInsert;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;
export type GoogleReviewGrant = typeof googleReviewGrants.$inferSelect;
