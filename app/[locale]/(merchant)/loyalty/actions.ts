"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth/get-business";
import { requireEntitlement } from "@/lib/entitlements/queries";
import {
  adjustBalance,
  recordAccrual,
  recordRedemption,
  upsertProgram,
} from "@/lib/loyalty/service";
import {
  InsufficientBalanceError,
  NoProgramConfiguredError,
  ProgramDisabledError,
} from "@/lib/loyalty/errors";
import { InvalidPhoneError, formatPhoneForDisplay } from "@/lib/utils/phone";

const upsertSchema = z.object({
  name: z.string().trim().max(80).optional(),
  accrualType: z.enum(["per_visit", "per_euro"]),
  accrualRate: z.number().positive().max(1000),
  rewardThreshold: z.number().positive().max(100000),
  rewardDescription: z.string().trim().min(2).max(160),
});

type UpsertResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function upsertProgramAction(
  input: z.input<typeof upsertSchema>,
): Promise<UpsertResult> {
  const { business } = await requireBusiness();
  try {
    await requireEntitlement(business.id, "loyalty");
  } catch {
    return { status: "error", message: "Module non activé" };
  }

  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Validation invalide";
    return { status: "error", message: first };
  }

  try {
    await upsertProgram(business.id, {
      name: parsed.data.name ?? null,
      accrualType: parsed.data.accrualType,
      accrualRate: parsed.data.accrualRate,
      rewardThreshold: parsed.data.rewardThreshold,
      rewardDescription: parsed.data.rewardDescription,
      enabled: true,
    });
    revalidatePath("/loyalty");
    revalidatePath("/home");
    return { status: "ok" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erreur inattendue";
    return { status: "error", message };
  }
}

const accrualSchema = z.object({
  phone: z.string().min(1),
  name: z.string().trim().max(80).nullable().optional(),
  amountSpent: z.number().nonnegative().optional(),
});

type AccrualActionResult =
  | {
      status: "ok";
      feedback: {
        customerId: string;
        phoneDisplay: string;
        name: string | null;
        delta: number;
        newBalance: number;
        rewardReady: boolean;
      };
    }
  | { status: "error"; message: string };

export async function recordAccrualAction(
  input: z.input<typeof accrualSchema>,
): Promise<AccrualActionResult> {
  const { business } = await requireBusiness();
  try {
    await requireEntitlement(business.id, "loyalty");
  } catch {
    return { status: "error", message: "Module non activé" };
  }

  const parsed = accrualSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Saisie invalide" };
  }

  try {
    const result = await recordAccrual({
      businessId: business.id,
      phone: parsed.data.phone,
      name: parsed.data.name ?? null,
      amountSpent: parsed.data.amountSpent,
      source: "manual_in_person",
    });
    revalidatePath("/loyalty");
    revalidatePath("/home");
    return {
      status: "ok",
      feedback: {
        customerId: result.customer.id,
        phoneDisplay: formatPhoneForDisplay(result.customer.phone),
        name: result.customer.name,
        delta: result.delta,
        newBalance: result.newBalance,
        rewardReady: result.rewardReady,
      },
    };
  } catch (err) {
    if (err instanceof InvalidPhoneError) {
      return { status: "error", message: err.message };
    }
    if (err instanceof NoProgramConfiguredError) {
      return { status: "error", message: err.message };
    }
    if (err instanceof ProgramDisabledError) {
      return { status: "error", message: err.message };
    }
    const message =
      err instanceof Error ? err.message : "Erreur inattendue";
    return { status: "error", message };
  }
}

type RedemptionResult =
  | { status: "ok"; newBalance: number }
  | { status: "error"; message: string };

export async function recordRedemptionAction(input: {
  customerId: string;
  note?: string;
}): Promise<RedemptionResult> {
  const { business } = await requireBusiness();
  try {
    await requireEntitlement(business.id, "loyalty");
  } catch {
    return { status: "error", message: "Module non activé" };
  }

  try {
    const res = await recordRedemption({
      businessId: business.id,
      customerId: input.customerId,
      note: input.note,
    });
    revalidatePath("/loyalty");
    return { status: "ok", newBalance: res.newBalance };
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      return { status: "error", message: err.message };
    }
    const message =
      err instanceof Error ? err.message : "Erreur inattendue";
    return { status: "error", message };
  }
}

export async function adjustBalanceAction(input: {
  customerId: string;
  delta: number;
  note: string;
}): Promise<{ status: "ok" } | { status: "error"; message: string }> {
  const { business } = await requireBusiness();
  try {
    await requireEntitlement(business.id, "loyalty");
  } catch {
    return { status: "error", message: "Module non activé" };
  }
  try {
    await adjustBalance({
      businessId: business.id,
      customerId: input.customerId,
      delta: input.delta,
      note: input.note,
    });
    revalidatePath("/loyalty");
    return { status: "ok" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erreur inattendue";
    return { status: "error", message };
  }
}
