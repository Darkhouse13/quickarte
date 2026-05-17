import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { businesses } from "./business";

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "staff",
  "customer",
]);

export const staffRoleEnum = pgEnum("staff_role", [
  "owner",
  "manager",
  "waiter",
  "kitchen",
  "cashier",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  phone: text("phone").unique(),
  role: userRoleEnum("role").notNull().default("customer"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const staffMembers = pgTable(
  "staff_members",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    email: text("email"),
    displayName: text("display_name").notNull(),
    role: staffRoleEnum("role").notNull(),
    pinHash: text("pin_hash"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessIdx: index("staff_members_business_id_idx").on(table.businessId),
    userBusinessActiveIdx: uniqueIndex(
      "staff_members_user_business_active_idx",
    )
      .on(table.userId, table.businessId)
      .where(sql`${table.userId} is not null and ${table.revokedAt} is null`),
    emailBusinessActiveIdx: uniqueIndex(
      "staff_members_email_business_active_idx",
    )
      .on(table.email, table.businessId)
      .where(sql`${table.email} is not null and ${table.revokedAt} is null`),
  }),
);

export const staffInviteTokens = pgTable(
  "staff_invite_tokens",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    staffMemberId: uuid("staff_member_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    staffMemberIdx: index("staff_invite_tokens_staff_member_id_idx").on(
      table.staffMemberId,
    ),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(businesses),
  sessions: many(sessions),
  accounts: many(accounts),
  staffMemberships: many(staffMembers),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const staffMembersRelations = relations(staffMembers, ({ one, many }) => ({
  business: one(businesses, {
    fields: [staffMembers.businessId],
    references: [businesses.id],
  }),
  user: one(users, {
    fields: [staffMembers.userId],
    references: [users.id],
  }),
  inviteTokens: many(staffInviteTokens),
}));

export const staffInviteTokensRelations = relations(
  staffInviteTokens,
  ({ one }) => ({
    staffMember: one(staffMembers, {
      fields: [staffInviteTokens.staffMemberId],
      references: [staffMembers.id],
    }),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
export type StaffMember = typeof staffMembers.$inferSelect;
export type NewStaffMember = typeof staffMembers.$inferInsert;
export type StaffInviteToken = typeof staffInviteTokens.$inferSelect;
