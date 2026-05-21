import {
  date,
  index,
  integer,
  jsonb,
  boolean,
  check,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { branches, businesses } from "./business";
import { categories, products } from "./catalog";

export const orderTypeEnum = pgEnum("order_type", [
  "dine_in",
  "takeaway",
  "delivery",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "paid",
  "refunded",
  "failed",
]);

export const paymentModeEnum = pgEnum("payment_mode", ["mad", "credits"]);

export const posStatusEnum = pgEnum("pos_status", [
  "not_required",
  "pending",
  "entered",
  "skipped",
]);

export const printerStationEnum = pgEnum("printer_station", [
  "counter",
  "kitchen",
  "bar",
]);

export const printerConnectionTypeEnum = pgEnum("printer_connection_type", [
  "manual",
  "escpos_lan",
  "escpos_usb",
  "webprint",
  "bluetooth",
]);

export const printJobStatusEnum = pgEnum("print_job_status", [
  "pending",
  "printed",
  "failed",
  "manual",
]);

export const reservationStatusEnum = pgEnum("reservation_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  customerAccessToken: text("customer_access_token").notNull(),
  type: orderTypeEnum("type").notNull().default("dine_in"),
  status: orderStatusEnum("status").notNull().default("pending"),
  paymentStatus: paymentStatusEnum("payment_status")
    .notNull()
    .default("unpaid"),
  paymentMode: paymentModeEnum("payment_mode").notNull().default("mad"),
  creditsUsed: integer("credits_used"),
  posStatus: posStatusEnum("pos_status").notNull().default("not_required"),
  posEnteredAt: timestamp("pos_entered_at", { withTimezone: true }),
  posEnteredByUserId: uuid("pos_entered_by_user_id"),
  posReference: text("pos_reference"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  tableNumber: text("table_number"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  platformFeeCents: integer("platform_fee_cents"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  customerAccessTokenIdx: uniqueIndex("orders_customer_access_token_idx").on(
    table.customerAccessToken,
  ),
  posStatusCreatedIdx: index("orders_business_pos_status_created_at_idx").on(
    table.businessId,
    table.posStatus,
    table.createdAt,
  ),
}));

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  creditUnitPrice: integer("credit_unit_price"),
  optionsJson: jsonb("options_json"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    actorUserId: uuid("actor_user_id"),
    actorRole: text("actor_role"),
    payloadJson: jsonb("payload_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orderIdx: index("order_events_order_id_idx").on(table.orderId),
    eventTypeIdx: index("order_events_event_type_idx").on(table.eventType),
  }),
);

export const printers = pgTable(
  "printers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    station: printerStationEnum("station").notNull(),
    connectionType: printerConnectionTypeEnum("connection_type").notNull(),
    address: text("address"),
    model: text("model"),
    notes: text("notes"),
    webprintToken: text("webprint_token"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastTestPrintAt: timestamp("last_test_print_at", { withTimezone: true }),
    enabled: boolean("enabled").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessIdx: index("printers_business_id_idx").on(table.businessId),
    branchIdx: index("printers_branch_id_idx").on(table.branchId),
    webprintTokenIdx: uniqueIndex("printers_webprint_token_idx").on(
      table.webprintToken,
    ),
  }),
);

export const printerAssignments = pgTable(
  "printer_assignments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    printerId: uuid("printer_id")
      .notNull()
      .references(() => printers.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull(),
    priority: integer("priority").notNull().default(0),
    fallbackPrinterId: uuid("fallback_printer_id").references(
      () => printers.id,
      { onDelete: "set null" },
    ),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    branchRolePrinterUnique: uniqueIndex(
      "printer_assignments_branch_role_printer_unique",
    ).on(table.branchId, table.role, table.printerId),
    businessIdx: index("printer_assignments_business_idx").on(table.businessId),
    branchIdx: index("printer_assignments_branch_idx").on(table.branchId),
    printerIdx: index("printer_assignments_printer_idx").on(table.printerId),
    roleCheck: check(
      "printer_assignments_role_check",
      sql`${table.role} in ('receipt', 'kitchen', 'bar', 'customer_copy')`,
    ),
    fallbackDifferentCheck: check(
      "printer_assignments_fallback_different_check",
      sql`${table.fallbackPrinterId} is null or ${table.fallbackPrinterId} <> ${table.printerId}`,
    ),
  }),
);

export const printJobs = pgTable(
  "print_jobs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid("order_id")
      .references(() => orders.id, { onDelete: "cascade" }),
    printerId: uuid("printer_id")
      .notNull()
      .references(() => printers.id, { onDelete: "restrict" }),
    status: printJobStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    payloadText: text("payload_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    printedAt: timestamp("printed_at", { withTimezone: true }),
  },
  (table) => ({
    orderIdx: index("print_jobs_order_id_idx").on(table.orderId),
    printerIdx: index("print_jobs_printer_id_idx").on(table.printerId),
    printerStatusCreatedIdx: index("print_jobs_printer_status_created_at_idx").on(
      table.printerId,
      table.status,
      table.createdAt,
    ),
  }),
);

export const categoryPrintRoutes = pgTable(
  "category_print_routes",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    station: printerStationEnum("station").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.businessId, table.categoryId, table.station],
    }),
    businessCategoryIdx: index("category_print_routes_business_category_idx").on(
      table.businessId,
      table.categoryId,
    ),
  }),
);

export const reservations = pgTable("reservations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  date: date("date").notNull(),
  time: time("time").notNull(),
  partySize: integer("party_size").notNull().default(1),
  status: reservationStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const stripeEvents = pgTable(
  "stripe_events",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    typeIdx: index("stripe_events_type_idx").on(table.type),
  }),
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  business: one(businesses, {
    fields: [orders.businessId],
    references: [businesses.id],
  }),
  items: many(orderItems),
  events: many(orderEvents),
  printJobs: many(printJobs),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, {
    fields: [orderEvents.orderId],
    references: [orders.id],
  }),
}));

export const printersRelations = relations(printers, ({ one, many }) => ({
  business: one(businesses, {
    fields: [printers.businessId],
    references: [businesses.id],
  }),
  branch: one(branches, {
    fields: [printers.branchId],
    references: [branches.id],
  }),
  printJobs: many(printJobs),
  assignments: many(printerAssignments),
}));

export const printerAssignmentsRelations = relations(
  printerAssignments,
  ({ one }) => ({
    business: one(businesses, {
      fields: [printerAssignments.businessId],
      references: [businesses.id],
    }),
    branch: one(branches, {
      fields: [printerAssignments.branchId],
      references: [branches.id],
    }),
    printer: one(printers, {
      fields: [printerAssignments.printerId],
      references: [printers.id],
    }),
    fallbackPrinter: one(printers, {
      fields: [printerAssignments.fallbackPrinterId],
      references: [printers.id],
    }),
  }),
);

export const printJobsRelations = relations(printJobs, ({ one }) => ({
  order: one(orders, {
    fields: [printJobs.orderId],
    references: [orders.id],
  }),
  printer: one(printers, {
    fields: [printJobs.printerId],
    references: [printers.id],
  }),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  business: one(businesses, {
    fields: [reservations.businessId],
    references: [businesses.id],
  }),
}));

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type StripeEvent = typeof stripeEvents.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type Printer = typeof printers.$inferSelect;
export type PrinterAssignment = typeof printerAssignments.$inferSelect;
export type PrintJob = typeof printJobs.$inferSelect;
export type CategoryPrintRoute = typeof categoryPrintRoutes.$inferSelect;
