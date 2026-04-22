import { and, eq, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import {
  loyaltyCustomers,
  loyaltyPrograms,
  loyaltyTransactions,
  type LoyaltyCustomer,
  type LoyaltyProgram,
} from "@/lib/db/schema";
import type { AccrualType, LoyaltySource } from "./types";
import { normalizeFrenchPhone } from "@/lib/utils/phone";
import {
  InsufficientBalanceError,
  NoProgramConfiguredError,
  ProgramDisabledError,
} from "./errors";

// These are expected control-flow errors (e.g. caller hits a disabled program),
// not failures worth paging on. Everything else gets captured.
const EXPECTED_ERRORS = new Set([
  NoProgramConfiguredError,
  ProgramDisabledError,
  InsufficientBalanceError,
]);

function captureUnexpected(
  err: unknown,
  tags: Record<string, string>,
  extra: Record<string, unknown>,
): void {
  const isExpected = Array.from(EXPECTED_ERRORS).some((E) => err instanceof E);
  if (isExpected) return;
  Sentry.captureException(err, { tags, extra });
}

type UpsertProgramInput = {
  name?: string | null;
  accrualType: AccrualType;
  accrualRate: number;
  rewardThreshold: number;
  rewardDescription: string;
  enabled?: boolean;
};

export async function upsertProgram(
  businessId: string,
  input: UpsertProgramInput,
): Promise<LoyaltyProgram> {
  const values = {
    businessId,
    name: input.name?.trim() ? input.name.trim() : null,
    accrualType: input.accrualType,
    accrualRate: input.accrualRate.toFixed(2),
    rewardThreshold: input.rewardThreshold.toFixed(2),
    rewardDescription: input.rewardDescription.trim(),
    enabled: input.enabled ?? true,
  };

  const [row] = await db
    .insert(loyaltyPrograms)
    .values(values)
    .onConflictDoUpdate({
      target: loyaltyPrograms.businessId,
      set: {
        name: values.name,
        accrualType: values.accrualType,
        accrualRate: values.accrualRate,
        rewardThreshold: values.rewardThreshold,
        rewardDescription: values.rewardDescription,
        enabled: values.enabled,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) throw new Error("Failed to upsert loyalty program");
  return row;
}

export type AccrualResult = {
  customer: LoyaltyCustomer;
  delta: number;
  newBalance: number;
  threshold: number;
  rewardReady: boolean;
};

type RecordAccrualInput = {
  businessId: string;
  phone: string;
  name?: string | null;
  amountSpent?: number;
  orderId?: string | null;
  source: LoyaltySource;
  note?: string | null;
};

function computeAccrualDelta(
  program: LoyaltyProgram,
  amountSpent: number | undefined,
): number {
  const rate = Number(program.accrualRate);
  if (program.accrualType === "per_visit") {
    return rate;
  }
  const amount = amountSpent ?? 0;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(rate * amount * 100) / 100;
}

export async function recordAccrual(
  input: RecordAccrualInput,
): Promise<AccrualResult> {
  try {
    return await recordAccrualImpl(input);
  } catch (err) {
    captureUnexpected(
      err,
      { area: "loyalty-accrual" },
      { businessId: input.businessId, source: input.source },
    );
    throw err;
  }
}

async function recordAccrualImpl(
  input: RecordAccrualInput,
): Promise<AccrualResult> {
  const phone = normalizeFrenchPhone(input.phone);

  return await db.transaction(async (tx) => {
    const program = await tx.query.loyaltyPrograms.findFirst({
      where: eq(loyaltyPrograms.businessId, input.businessId),
    });
    if (!program) throw new NoProgramConfiguredError();
    if (!program.enabled) throw new ProgramDisabledError();

    const delta = computeAccrualDelta(program, input.amountSpent);

    let customer = await tx.query.loyaltyCustomers.findFirst({
      where: and(
        eq(loyaltyCustomers.businessId, input.businessId),
        eq(loyaltyCustomers.phone, phone),
      ),
    });

    if (!customer) {
      const [inserted] = await tx
        .insert(loyaltyCustomers)
        .values({
          businessId: input.businessId,
          phone,
          name: input.name?.trim() ? input.name.trim() : null,
          balance: delta.toFixed(2),
          lifetimeEarned: delta.toFixed(2),
          lastVisitAt: new Date(),
        })
        .returning();
      if (!inserted) throw new Error("Failed to create loyalty customer");
      customer = inserted;
    } else {
      const newBalance = Number(customer.balance) + delta;
      const newLifetime = Number(customer.lifetimeEarned) + delta;
      const [updated] = await tx
        .update(loyaltyCustomers)
        .set({
          balance: newBalance.toFixed(2),
          lifetimeEarned: newLifetime.toFixed(2),
          lastVisitAt: new Date(),
          name:
            customer.name ??
            (input.name?.trim() ? input.name.trim() : null),
          updatedAt: new Date(),
        })
        .where(eq(loyaltyCustomers.id, customer.id))
        .returning();
      if (!updated) throw new Error("Failed to update loyalty customer");
      customer = updated;
    }

    await tx.insert(loyaltyTransactions).values({
      businessId: input.businessId,
      customerId: customer.id,
      orderId: input.orderId ?? null,
      type: "earn",
      delta: delta.toFixed(2),
      source: input.source,
      note: input.note?.trim() ? input.note.trim() : null,
    });

    const newBalance = Number(customer.balance);
    const threshold = Number(program.rewardThreshold);
    return {
      customer,
      delta,
      newBalance,
      threshold,
      rewardReady: newBalance >= threshold,
    };
  });
}

type RecordRedemptionInput = {
  businessId: string;
  customerId: string;
  note?: string | null;
};

export type RedemptionResult = {
  customer: LoyaltyCustomer;
  threshold: number;
  newBalance: number;
};

export async function recordRedemption(
  input: RecordRedemptionInput,
): Promise<RedemptionResult> {
  return await db.transaction(async (tx) => {
    const program = await tx.query.loyaltyPrograms.findFirst({
      where: eq(loyaltyPrograms.businessId, input.businessId),
    });
    if (!program) throw new NoProgramConfiguredError();

    const customer = await tx.query.loyaltyCustomers.findFirst({
      where: and(
        eq(loyaltyCustomers.businessId, input.businessId),
        eq(loyaltyCustomers.id, input.customerId),
      ),
    });
    if (!customer) throw new Error("Customer not found");

    const balance = Number(customer.balance);
    const threshold = Number(program.rewardThreshold);
    if (balance < threshold) throw new InsufficientBalanceError();

    const newBalance = balance - threshold;
    const [updated] = await tx
      .update(loyaltyCustomers)
      .set({
        balance: newBalance.toFixed(2),
        lifetimeRedeemed: sql`${loyaltyCustomers.lifetimeRedeemed} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyCustomers.id, customer.id))
      .returning();
    if (!updated) throw new Error("Failed to update customer after redemption");

    await tx.insert(loyaltyTransactions).values({
      businessId: input.businessId,
      customerId: customer.id,
      type: "redeem",
      delta: (-threshold).toFixed(2),
      source: "manual_in_person",
      note: input.note?.trim() ? input.note.trim() : null,
    });

    return { customer: updated, threshold, newBalance };
  });
}

type AdjustBalanceInput = {
  businessId: string;
  customerId: string;
  delta: number;
  note: string;
};

export async function adjustBalance(
  input: AdjustBalanceInput,
): Promise<LoyaltyCustomer> {
  if (!Number.isFinite(input.delta) || input.delta === 0) {
    throw new Error("Delta invalide");
  }
  return await db.transaction(async (tx) => {
    const customer = await tx.query.loyaltyCustomers.findFirst({
      where: and(
        eq(loyaltyCustomers.businessId, input.businessId),
        eq(loyaltyCustomers.id, input.customerId),
      ),
    });
    if (!customer) throw new Error("Customer not found");

    const newBalance = Math.max(0, Number(customer.balance) + input.delta);
    const [updated] = await tx
      .update(loyaltyCustomers)
      .set({
        balance: newBalance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(loyaltyCustomers.id, customer.id))
      .returning();
    if (!updated) throw new Error("Failed to update balance");

    await tx.insert(loyaltyTransactions).values({
      businessId: input.businessId,
      customerId: customer.id,
      type: "adjust",
      delta: input.delta.toFixed(2),
      source: "admin_adjust",
      note: input.note.trim(),
    });

    return updated;
  });
}

