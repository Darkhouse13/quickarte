import {
  boolean,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { businesses } from "./business";

export const discountTypeEnum = pgEnum("discount_type", [
  "percentage",
  "fixed_amount",
]);

export const promoCodes = pgTable("promo_codes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  discountType: discountTypeEnum("discount_type")
    .notNull()
    .default("percentage"),
  discountValue: numeric("discount_value", {
    precision: 10,
    scale: 2,
  }).notNull(),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const promoCodesRelations = relations(promoCodes, ({ one }) => ({
  business: one(businesses, {
    fields: [promoCodes.businessId],
    references: [businesses.id],
  }),
}));

export type PromoCode = typeof promoCodes.$inferSelect;

export const contactRequests = pgTable(
  "contact_requests",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    nom: text("nom").notNull(),
    commerce: text("commerce").notNull(),
    ville: text("ville").notNull(),
    telephone: text("telephone").notNull(),
    message: text("message"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    emailSent: boolean("email_sent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("contact_requests_ip_created_idx").on(t.ip, t.createdAt),
    index("contact_requests_created_idx").on(t.createdAt),
  ],
);

export type ContactRequest = typeof contactRequests.$inferSelect;
