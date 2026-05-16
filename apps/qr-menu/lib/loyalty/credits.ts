import { and, desc, eq, sql, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  creditTransactions,
  loyaltyMembers,
  type CreditTransaction,
} from "@quickarte/db-schema";
import { normalizeMoroccanPhone } from "@/lib/utils/phone";

type TransactionLike = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class InsufficientCreditsError extends Error {
  readonly code = "INSUFFICIENT_CREDITS";

  constructor(message = "Solde de credits insuffisant.") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

export type ApplyCreditTransactionInput = {
  businessId: string;
  phoneRaw: string;
  amount: number;
  source:
    | "order_spend"
    | "google_review"
    | "manual_grant"
    | "redemption"
    | "manual_adjustment";
  sourceRef?: string | null;
  description?: string | null;
  actorUserId?: string | null;
};

export type ApplyCreditTransactionOptions = {
  tx: TransactionLike;
};

export async function getCreditBalance(
  businessId: string,
  phoneRaw: string,
): Promise<number> {
  const phone = normalizeMoroccanPhone(phoneRaw);
  const member = await db.query.loyaltyMembers.findFirst({
    where: and(
      eq(loyaltyMembers.businessId, businessId),
      eq(loyaltyMembers.customerPhoneNormalized, phone),
    ),
    columns: { balance: true },
  });
  return member?.balance ?? 0;
}

export async function applyCreditTransaction(
  input: ApplyCreditTransactionInput,
  opts: ApplyCreditTransactionOptions,
): Promise<CreditTransaction> {
  const phone = normalizeMoroccanPhone(input.phoneRaw);
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw new Error("Montant de credits invalide.");
  }

  const existing = await findSystemTransaction(input, opts.tx);
  if (existing) return existing;

  const currentMember = await opts.tx.query.loyaltyMembers.findFirst({
    where: and(
      eq(loyaltyMembers.businessId, input.businessId),
      eq(loyaltyMembers.customerPhoneNormalized, phone),
    ),
    columns: { id: true, balance: true },
  });
  const currentBalance = currentMember?.balance ?? 0;
  const nextBalance = currentBalance + input.amount;
  if (nextBalance < 0) throw new InsufficientCreditsError();

  const [inserted] = await opts.tx
    .insert(creditTransactions)
    .values({
      businessId: input.businessId,
      customerPhoneNormalized: phone,
      amount: input.amount,
      source: input.source,
      sourceRef: input.sourceRef ?? null,
      description: input.description?.trim() ? input.description.trim() : null,
      actorUserId: input.actorUserId ?? null,
    })
    .onConflictDoNothing()
    .returning();

  if (!inserted) {
    const retryExisting = await findSystemTransaction(input, opts.tx);
    if (retryExisting) return retryExisting;
    throw new Error("Impossible d'enregistrer la transaction de credits.");
  }

  await opts.tx
    .insert(loyaltyMembers)
    .values({
      businessId: input.businessId,
      customerPhoneNormalized: phone,
      balance: nextBalance,
      lastActivityAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        loyaltyMembers.businessId,
        loyaltyMembers.customerPhoneNormalized,
      ],
      set: {
        balance: nextBalance,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      },
    });

  return inserted;
}

export async function getCreditLedger(
  businessId: string,
  phoneRaw: string,
  limit = 50,
): Promise<CreditTransaction[]> {
  const phone = normalizeMoroccanPhone(phoneRaw);
  return await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.businessId, businessId),
        eq(creditTransactions.customerPhoneNormalized, phone),
      ),
    )
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);
}

export async function recomputeCreditBalance(
  businessId: string,
  phoneRaw: string,
  tx: TransactionLike | typeof db = db,
): Promise<number> {
  const phone = normalizeMoroccanPhone(phoneRaw);
  const [row] = await tx
    .select({ value: sum(creditTransactions.amount) })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.businessId, businessId),
        eq(creditTransactions.customerPhoneNormalized, phone),
      ),
    );
  const balance = Number(row?.value ?? 0);
  await tx
    .insert(loyaltyMembers)
    .values({
      businessId,
      customerPhoneNormalized: phone,
      balance,
      lastActivityAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        loyaltyMembers.businessId,
        loyaltyMembers.customerPhoneNormalized,
      ],
      set: {
        balance,
        updatedAt: new Date(),
      },
    });
  return balance;
}

async function findSystemTransaction(
  input: ApplyCreditTransactionInput,
  tx: TransactionLike,
): Promise<CreditTransaction | null> {
  if (
    !input.sourceRef ||
    !["order_spend", "google_review", "redemption"].includes(input.source)
  ) {
    return null;
  }
  const row = await tx.query.creditTransactions.findFirst({
    where: and(
      eq(creditTransactions.businessId, input.businessId),
      eq(creditTransactions.source, input.source),
      eq(creditTransactions.sourceRef, input.sourceRef),
    ),
  });
  return row ?? null;
}

export function assertCreditInvariant(memberBalance: number, ledgerSum: number): void {
  if (memberBalance !== ledgerSum) {
    throw new Error(
      `Credit invariant failed: loyalty_members.balance=${memberBalance}, ledger=${ledgerSum}`,
    );
  }
}
