import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { businesses } from "./business";

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "staff",
  "customer",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: text("phone").unique(),
  email: text("email").unique(),
  name: text("name"),
  role: userRoleEnum("role").notNull().default("customer"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(businesses),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
