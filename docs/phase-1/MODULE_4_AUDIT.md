# Module 4 Audit - Recipe And Ingredient Engine

Date: 2026-05-23
Branch audited: `phase-0-foundation`

This is a read-only findings document for Module 4 design. No schema, migration,
controller, service, or UI changes were made as part of this audit.

## Executive Findings

Module 4 is greenfield for first-class ingredient, recipe, stock, inventory,
supplier, unit-of-measure, yield, and stock-ledger tables. The schema package has
no existing tables named or shaped like ingredients, recipes, stock/inventory
quantities, supplier purchasing, unit conversion, ingredient cost, or stock
movements.

The seams Module 4 must extend are:

- `product_variants`: the sellable unit boundary introduced in Module 3.
- `modifier_value_templates.recipe_hook_key`: an inert placeholder for future
  modifier-driven recipe deltas.
- `orders` / `order_items`: Quickarte's current order lifecycle and sale lines.
- `branches`: branch/location dimension for future stock ledger and stock on hand.
- `DatabaseService.withTenant()` + strict RLS policy pattern for new tenant-owned
  tables.

Important design implication: existing Quickarte order placement and validation
still use JavaScript number math for customer QR orders. Module 4 should not copy
that pattern. New recipe, cost, stock, and quantity math should use decimal-safe
server-side math and string API contracts.

## 1. Existing Inventory / Ingredient / Recipe / Stock Schema

Searches covered:

- `packages/db-schema/src`
- `packages/db-schema/migrations`
- `apps/qr-menu/lib`
- `apps/qr-menu/app`
- `apps/api/src`

Search terms included: `ingredient`, `recipe`, `stock`, `inventory`, `supplier`,
`vendor`, `uom`, `unit of measure`, `on_hand`, `cost`, `yield`, `deduct`,
`deduction`.

Result: no first-class inventory/ingredient/recipe/stock/supplier schema exists.

The only matching production schema fields are money/price/unit-label fields in
catalog/order/printing code, and the Module 3 placeholder:

- `products.price`
- `product_variants.price_override`
- `product_variants.display_price_min`
- `product_variants.display_price_max`
- `product_variants.unit_label`
- `modifier_value_templates.recipe_hook_key`
- `orders.total`
- `order_items.unit_price`
- `order_items.subtotal`

No current table stores:

- ingredient catalog
- unit-of-measure catalog
- unit conversions
- recipe headers or recipe lines
- sub-recipes
- raw-to-cooked yield
- batch/prep recipes
- stock on hand
- stock ledger/movements
- ingredient supplier links
- supplier profiles
- purchase orders or receiving
- ingredient cost history

So Module 4 should be designed as new tenant-owned tables, not as a retrofit of
an existing inventory subsystem.

## 2. Product / Variant Model Recipes Attach To

Current catalog definitions live in
`packages/db-schema/src/schema/catalog.ts`.

### Products

Reference: `packages/db-schema/src/schema/catalog.ts:103`

```ts
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
```

### Product Variants

Reference: `packages/db-schema/src/schema/catalog.ts:160`

```ts
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
```

### Sellable Boundary Finding

Variants are the per-sellable-unit boundary:

- Module 3's closeout explicitly says recipes attach per variant.
- The effective menu resolver returns a synthetic default variant when a product
  has no real `product_variants` rows.
- Branch price overrides key by `variant_id`, not just product.
- Quickarte order validation snapshots `variant_id`, variant name, and variant
  price when variants exist.

Effective-menu synthetic variant logic:

Reference: `apps/api/src/menu-catalog/effective-menu.resolver.ts:978`

```ts
private resolveVariants(
  product: typeof products.$inferSelect,
  variants: Array<typeof productVariants.$inferSelect>,
  overridesByVariant: Map<string, typeof branchProductPriceOverrides.$inferSelect>,
): EffectiveMenuResponse["categories"][number]["products"][number]["variants"] {
  if (variants.length === 0) {
    return [
      {
        id: null,
        name: "Default",
        price: product.price,
        priceSource: "inherited",
        isDefault: true,
        available: product.available,
        position: 0,
        variantKind: "custom",
        pricingMode: "fixed",
        displayPriceLabel: null,
        displayPriceMin: null,
        displayPriceMax: null,
        unitLabel: null,
        synthetic: true,
      },
    ];
  }
  return variants
    .filter((variant) => variant.available)
    .map((variant) => {
      const override = overridesByVariant.get(variant.id);
      return {
        id: variant.id,
        name: variant.name,
        price:
          variant.pricingMode === "fixed"
            ? override?.price ?? variant.priceOverride ?? product.price
            : null,
        priceSource: override ? "overridden" : "inherited",
        isDefault: variant.isDefault,
        available: variant.available,
        position: variant.position,
        variantKind: variant.variantKind,
        pricingMode: variant.pricingMode,
        displayPriceLabel: variant.displayPriceLabel,
        displayPriceMin: variant.displayPriceMin,
        displayPriceMax: variant.displayPriceMax,
        unitLabel: variant.unitLabel,
        synthetic: false,
      };
    });
}
```

### Cost Field Finding

Neither `products` nor `product_variants` currently has a cost column.

Existing money fields are sale/display prices only:

- `products.price`
- `product_variants.price_override`
- `product_variants.display_price_min`
- `product_variants.display_price_max`

Any product/variant cost in Module 4 will be new. Recommendation for design:
computed recipe cost should be derived from recipe lines and ingredient costs,
not stored directly on Quickarte-shared `products` or `product_variants` unless
there is a deliberate cached-cost strategy with invalidation.

## 3. Modifier Recipe Placeholder

The placeholder exists on `modifier_value_templates`, not on materialized
`option_values`.

Reference: `packages/db-schema/src/schema/catalog.ts:446`

```ts
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
```

Migration origin:

Reference: `packages/db-schema/migrations/0030_reusable_modifiers.sql:38`

```sql
"recipe_hook_key" text,
```

How it is currently set:

- Admin web exposes an input in `apps/admin-web/src/pages/MenuCatalogPage.tsx`.
- API accepts it through Module 3 Zod schemas.
- `menu-catalog.service.ts` writes it when creating/updating modifier value
  templates and copies it into response DTOs.

How it is currently read:

- The effective-menu resolver includes `recipeHookKey` in modifier value output.
- No code performs ingredient deduction, recipe lookup, stock movement, or cost
  calculation from `recipeHookKey`.

Current usage search found only:

- schema definition
- migration definition
- admin edit form
- API DTO/service pass-through
- effective-menu response pass-through
- tests asserting it round-trips

So it is truly inert today.

## 4. Order Lifecycle And Completion Hook Point

### Order Status Values

Reference: `packages/db-schema/src/schema/ordering.ts:29`

```ts
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);
```

Reference: `apps/qr-menu/lib/ordering/status.ts:3`

```ts
export type OrderLifecycleStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export const ORDER_STATUS_TRANSITIONS: Record<
  OrderLifecycleStatus,
  OrderLifecycleStatus[]
> = {
  pending: ["confirmed", "preparing", "cancelled"],
  confirmed: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
```

### Orders And Order Items

Reference: `packages/db-schema/src/schema/ordering.ts:82`

```ts
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
```

Reference: `packages/db-schema/src/schema/ordering.ts:125`

```ts
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
```

Finding: `order_items` has `product_id` and `options_json`, but no first-class
`variant_id` column. Variant and option selections are snapshotted inside
`options_json` when configuration exists. Module 4 stock deduction must account
for both current data shapes:

- old/simple rows with product only and no variant snapshot
- configured rows with variant/options captured in `options_json`

### Current Completion Path

The narrow floor-service path is:

1. UI/server action calls `markOrderServed(orderId)`.
2. `markOrderServed()` calls `transitionOrder(orderId, "completed", ...)`.
3. `transitionOrder()` updates `orders.status`, writes `order.served`, commits.
4. After the status transaction, `transitionOrder()` invokes loyalty credit
   accrual non-fatally.

Reference: `apps/qr-menu/lib/ordering/actions.ts:354`

```ts
// Marks a ready order as served by moving it to the terminal `completed`
// lifecycle status. The only legal source state is `ready`; `completed` is
// accepted as an idempotent no-op so retrying the action does not create a
// second `order.served` event. Future snack workflows may justify a direct
// `preparing -> completed` path, but this action intentionally keeps the
// production transition narrow until field research supports it.
export async function markOrderServed(
  orderId: string,
): Promise<TransitionResult> {
  const { session, business } = await requireBusiness();
  const role = await assertRole(session.user.id, business.id, [
    "owner",
    "manager",
    "waiter",
    "cashier",
  ]);
  const result = await transitionOrder(
    orderId,
    "completed",
    { userId: session.user.id, role },
    { businessId: business.id },
  );
```

There is also a generic helper:

Reference: `apps/qr-menu/lib/ordering/actions.ts:440`

```ts
export async function completeOrder(orderId: string): Promise<void> {
  await transitionOrderStatus(orderId, "completed");
}
```

The status transition core:

Reference: `apps/qr-menu/lib/ordering/transitions.ts:41`

```ts
export async function transitionOrder(
  orderId: string,
  toStatus: OrderLifecycleStatus,
  actor: OrderEventActor,
  opts: TransitionOrderOptions = {},
): Promise<TransitionOrderResult> {
  const deps = opts.deps ?? defaultDeps;
  const result: TransitionOrderResult = await deps.transaction(async (tx: TransactionLike) => {
    const order = await tx.query.orders.findFirst({
      where: opts.businessId
        ? and(eq(orders.id, orderId), eq(orders.businessId, opts.businessId))
        : eq(orders.id, orderId),
      columns: { id: true, status: true },
    });
    if (!order) return { status: "not_found" };

    const fromStatus = order.status as OrderLifecycleStatus;
    if (fromStatus === toStatus) {
      return { status: "success", fromStatus, toStatus };
    }

    if (!validateOrderTransition(fromStatus, toStatus)) {
      return { status: "invalid_transition", fromStatus, toStatus };
    }

    await tx
      .update(orders)
      .set({
        status: toStatus,
        notes: opts.notes,
        updatedAt: new Date(),
      })
      .where(
        opts.businessId
          ? and(eq(orders.id, orderId), eq(orders.businessId, opts.businessId))
          : eq(orders.id, orderId),
      );

    await deps.recordEvent(orderId, eventForStatus(toStatus), {
      actor,
      payload: { from_status: fromStatus, to_status: toStatus, ...opts.payload },
      tx,
    });

    return { status: "success", fromStatus, toStatus };
  });
  if (
    result.status === "success" &&
    result.toStatus === "completed" &&
    result.fromStatus !== "completed"
  ) {
    try {
      await deps.accrueCredits?.(orderId);
    } catch (err) {
      console.error("[loyalty] credit accrual on order.served failed (non-fatal):", err);
    }
  }
  return result;
}
```

Event mapping:

Reference: `apps/qr-menu/lib/ordering/transitions.ts:108`

```ts
function eventForStatus(status: OrderLifecycleStatus): OrderEventType {
  switch (status) {
    case "confirmed":
      return "order.accepted";
    case "preparing":
      return "order.preparing";
    case "ready":
      return "order.ready";
    case "completed":
      return "order.served";
    case "cancelled":
      return "order.cancelled";
    case "pending":
      return "order.created";
  }
}
```

### Side Effects On Completion

On `completed` transition:

- In the same status transaction:
  - `orders.status` updated to `completed`
  - `order_events` row inserted with `event_type = 'order.served'`
- After that transaction:
  - `accrueCreditsForServedOrder(orderId)` runs non-fatally.

Reference: `apps/qr-menu/lib/loyalty/accrual.ts:6`

```ts
export async function accrueCreditsForServedOrder(orderId: string): Promise<void> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    columns: {
      id: true,
      businessId: true,
      customerPhone: true,
      paymentMode: true,
      total: true,
    },
  });
  if (!order) return;

  const program = await db.query.loyaltyPrograms.findFirst({
    where: eq(loyaltyPrograms.businessId, order.businessId),
  });
  if (!program?.enabled || program.loyaltyType !== "credits") return;
  const { hasEntitlement } = await import("@/lib/entitlements/queries");
  if (!(await hasEntitlement(order.businessId, "loyalty"))) return;
  if (order.paymentMode !== "mad") return;
  if (!order.customerPhone?.trim()) return;

  const total = Number(order.total);
  const minOrder = Number(program.minOrderForAccrualMad);
  if (!Number.isFinite(total) || total < minOrder) return;

  const amount = Math.floor(total * Number(program.accrualPerMad));
  if (amount <= 0) return;

  await db.transaction(async (tx) => {
    await applyCreditTransaction(
      {
        businessId: order.businessId,
        phoneRaw: order.customerPhone ?? "",
        amount,
        source: "order_spend",
        sourceRef: order.id,
        description: "Credits gagnes sur commande servie",
      },
      { tx },
    );
  });
}
```

On initial order placement, there are also side effects, but these happen before
completion:

- `order.created` event
- print-job enqueue, non-fatal
- legacy loyalty accrual on order creation for older loyalty program mode,
  non-fatal
- push notification, non-fatal

Reference: `apps/qr-menu/lib/ordering/actions.ts:194`

```ts
const insertedOrder = await db.transaction(async (tx) => {
  const customerAccessToken = generateCustomerAccessToken();
  const [order] = await tx
    .insert(orders)
    .values({
      businessId: business.id,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerAccessToken,
      type: data.orderType,
      status: "pending",
      posStatus: business.settings?.posCoexistenceEnabled
        ? "pending"
        : "not_required",
      total: total.toFixed(2),
      notes: data.notes ?? null,
      tableNumber:
        data.orderType === "dine_in" && data.tableNumber !== undefined
          ? String(data.tableNumber)
          : null,
    })
    .returning({ id: orders.id });

  if (!order) throw new Error("Failed to insert order");

  await tx.insert(orderItems).values(
    itemLines.map((l) => ({
      orderId: order.id,
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice.toFixed(2),
      subtotal: l.subtotal.toFixed(2),
      optionsJson: l.optionsJson,
    })),
  );

  await recordOrderEvent(order.id, "order.created", {
    actor: { userId: null, role: "customer" },
    payload: { order_type: data.orderType, total: total.toFixed(2) },
    tx,
  });

  return { id: order.id, customerAccessToken };
});
```

Module 4 hook recommendation for design: the eventual stock deduction should
attach to the same final transition surface as `order.served`, ideally inside the
status transition transaction or a new API-owned order-finalization transaction.
If deduction must be atomic with `completed`, it cannot be a best-effort
post-transaction side effect like loyalty accrual is today.

## 5. Existing QR Order Line Shape

Quickarte validates lines against products, variants, and options.

Reference: `apps/qr-menu/lib/ordering/line-validation.ts:17`

```ts
export type DbProductForOrder = {
  id: string;
  name: string;
  price: string;
  available: boolean;
  variants: Array<{
    id: string;
    productId: string;
    name: string;
    priceOverride: string | null;
    isDefault: boolean;
    available: boolean;
  }>;
  options: Array<{
    id: string;
    productId: string;
    name: string;
    type: OrderItemOptionType;
    required: boolean;
    minSelect: number;
    maxSelect: number | null;
    available: boolean;
    values: Array<{
      id: string;
      optionId: string;
      name: string;
      priceAddition: string;
      available: boolean;
    }>;
  }>;
};
```

Price calculation in current Quickarte code uses numbers:

Reference: `apps/qr-menu/lib/ordering/line-validation.ts:167`

```ts
const unitPrice = roundMoney(
  Number(variant?.priceOverride ?? product.price) + additions,
);
if (unitPrice < 0) {
  return validationError(
    "PRICE_RESOLVED_NEGATIVE",
    "Le prix de cet article est invalide.",
  );
}

const subtotal = roundMoney(unitPrice * item.quantity);
```

This is a compatibility surface, not the desired pattern for Module 4+. Module 4
should treat this as legacy Quickarte behavior and avoid extending it for stock
or cost computation.

## 6. Numeric / Money Conventions

Phase 1 convention:

Reference: `docs/phase-1/CONVENTIONS.md:44`

```md
Money values -- prices, totals, subtotals, tax amounts, discounts, tips,
service-charge amounts, any value denominated in currency -- are stored as
Postgres `numeric` and represented across the API as STRINGS (decimal strings
like "42.50"), never as JavaScript floating-point numbers. All money arithmetic
(summing line items, computing tax, applying discounts, computing change)
happens server-side using decimal-safe math (integer minor units i.e. centimes,
or a decimal library), NEVER client-side float math and NEVER with JS `+`/`*`
on float dollars.
```

Exact money-like numeric columns currently used:

Catalog:

- `products.price`: `numeric(10,2)`
- `product_variants.price_override`: `numeric(10,2)`
- `product_variants.display_price_min`: `numeric(10,2)`
- `product_variants.display_price_max`: `numeric(10,2)`
- `modifier_group_templates.extra_price`: `numeric(10,2)`
- `modifier_value_templates.price_addition`: `numeric(10,2)`
- `product_options.extra_price`: `numeric(10,2)`
- `option_values.price_addition`: `numeric(10,2)`

Branch overrides:

- `branch_product_price_overrides.price`: `numeric(10,2)`
- `branch_option_value_overrides.price_addition`: `numeric(10,2)`

Orders:

- `orders.total`: `numeric(10,2)`
- `order_items.unit_price`: `numeric(10,2)`
- `order_items.subtotal`: `numeric(10,2)`

Non-money numeric rates/coordinates:

- `tax_rates.rate`: `numeric(5,2)`
- `branch_tax_settings.service_charge_rate`: `numeric(5,2)`
- `businesses.lat/lng` and `branches.lat/lng`: `numeric(10,7)`

Module 4 design implication:

- Ingredient costs are money and should be `numeric`, represented through API as
  decimal strings.
- Stock quantities are not money but still need decimal-safe math. They should
  not use JavaScript floats either. Use Postgres `numeric` for fractional
  quantities and convert with a decimal library or normalized integer base units
  in service code.

## 7. Tenant And Branch Dimensions

### Tenant Key

`business_id` remains the tenant key.

Reference: `docs/phase-1/CONVENTIONS.md:38`

```md
`business_id` remains the RLS tenant key. `branch_id` is a filtering and
authorization dimension, never a tenant key. New tenant-scoped tables must
include strict RLS in the same migration that creates them.
```

### Branch Definition

Reference: `packages/db-schema/src/schema/business.ts:69`

```ts
export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    postcode: varchar("postcode", { length: 16 }),
    countryCode: varchar("country_code", { length: 2 }).notNull().default("MA"),
    googlePlaceId: text("google_place_id"),
    formattedAddress: text("formatted_address"),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    socialLinks: jsonb("social_links"),
    logo: text("logo"),
    cuisineType: text("cuisine_type"),
    seatingCapacity: integer("seating_capacity"),
    currency: text("currency"),
    timezone: text("timezone"),
    locale: text("locale"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    businessSlugUnique: uniqueIndex("branches_business_slug_unique").on(
      table.businessId,
      table.slug,
    ).where(sql`${table.deletedAt} is null`),
    defaultBranchUnique: uniqueIndex("branches_one_default_per_business_idx")
      .on(table.businessId)
      .where(sql`${table.isDefault} = true and ${table.deletedAt} is null`),
    businessIdx: index("branches_business_id_idx").on(table.businessId),
    activeIdx: index("branches_business_active_idx")
      .on(table.businessId, table.deletedAt)
      .where(sql`${table.deletedAt} is null`),
    seatingCapacityCheck: check(
      "branches_seating_capacity_non_negative",
      sql`${table.seatingCapacity} is null or ${table.seatingCapacity} >= 0`,
    ),
  }),
);
```

Module 4 design implication:

- Recipes are likely business/catalog scoped, and should attach to
  `product_variants`.
- Stock on hand and stock ledger should be branch/location scoped through
  `branch_id`.
- Future Module 5 may add sub-locations within a branch, but Module 4 should not
  ignore branch dimension if stock deduction is meant to be per location.

### RLS Pattern

Reference: `packages/db-schema/migrations/0024_branch_foundation.sql:109`

```sql
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "branches_tenant_isolation" ON "branches"
  USING ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.current_business_id', true), '')::uuid);
```

API transaction-scoped tenant context:

Reference: `apps/api/src/database/database.service.ts:41`

```ts
/**
 * The only approved entry point for querying tenanted tables.
 *
 * PostgreSQL pools reuse connections, so tenant context must be transaction
 * scoped. Do not set app.current_business_id at session scope, and do not
 * inject DRIZZLE_CLIENT into feature modules that touch tenanted data.
 */
async withTenant<T>(
  businessId: string,
  callback: (tx: TenantedDrizzleClient) => Promise<T>,
): Promise<T> {
  if (!UUID_PATTERN.test(businessId)) {
    throw new Error("Invalid business_id tenant context");
  }

  return this.db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL app.current_business_id = '${businessId}'`));
    return callback(tx);
  });
}
```

Module 4 design implication:

- New tenant-owned Module 4 tables should include `business_id`.
- Branch/location tables should include both `business_id` and `branch_id`.
- Strict RLS should ship in the same migration as each new table.
- Any reads of Quickarte-shared tables such as `products`, `product_variants`,
  `orders`, and `order_items` must explicitly filter by `business_id` unless and
  until those shared tables get RLS in a later refactor.

## 8. Supplier / Cost Seams

No supplier tables or supplier cost tables exist.

Existing cost-like fields:

- Sale/display prices in catalog and order lines.
- Loyalty credit balances and accrual rates.
- Stripe/payment fields on `orders` / `businesses`.

None of these are ingredient cost or supplier price data.

Seam with Module 5:

- Module 4 can define ingredient catalog, recipe lines, computed recipe cost,
  and stock deduction ledger.
- Module 5 should own supplier profiles, purchase orders, receiving, invoice
  costs, supplier-specific ingredient prices, min/max par, and broader inventory
  management.
- If Module 4 needs a `current_cost_per_uom`, decide whether it is manually
  editable in Module 4 or a cached value that Module 5 later updates from
  receiving. Avoid creating a supplier model in Module 4 unless PM explicitly
  pulls Module 5 scope forward.

## 9. Design Risks To Carry Into Module 4

1. Variant attachment:
   Recipes should attach to `product_variants.id`. Products with only synthetic
   default variants have no physical variant row, so Module 4 must decide
   whether recipe creation auto-materializes a default variant or supports a
   product-level fallback recipe. Auto-materializing a real default variant is
   cleaner for the "variant is sellable unit" rule.

2. Order item snapshot:
   `order_items` does not have a first-class `variant_id`. Current selection is
   in `options_json`. Deduction must parse snapshots for legacy QR orders or wait
   for Module 6's API-owned order lines to include explicit variant IDs.

3. Atomic stock deduction:
   The current completion transaction updates order status and writes an event.
   Loyalty accrual happens after commit and is non-fatal. The stock deduction
   promise requires atomicity with the final sale state, so Module 4 should not
   imitate the post-commit loyalty pattern.

4. Decimal-safe quantity math:
   Existing Quickarte QR validation uses JS numbers. Module 4 quantities, yields,
   and costs should use decimal-safe math from the start.

5. Branch/location:
   Existing orders are business-scoped and do not yet carry `branch_id`.
   Module 6 POS order flow likely needs branch-aware orders before production
   stock deduction can be correct for multi-branch operators. For Quickarte QR
   legacy orders, default branch fallback may be needed as an interim policy.

## 10. Greenfield / Extension Verdict

Module 4 is greenfield for recipe, ingredient, unit, cost, stock, and supplier
schema. It is not a duplicate of an existing subsystem.

It is not isolated greenfield, though: it must extend the existing Module 3
catalog and Quickarte order surfaces:

- Attach recipe headers to `product_variants`.
- Attach modifier deltas to modifier value templates or a new join keyed by
  `modifier_value_template_id`.
- Read order lines and final-order transitions carefully.
- Use `business_id` for tenancy and `branch_id` for stock location.
- Use strict RLS on new tables and explicit `business_id` filters on shared
  Quickarte tables.
