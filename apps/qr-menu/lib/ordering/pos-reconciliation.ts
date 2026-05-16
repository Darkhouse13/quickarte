import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import type { StaffRole } from "@/lib/identity/permissions";
import { recordOrderEvent, type OrderEventType } from "@/lib/ordering/events";

export type PosStatus = "not_required" | "pending" | "entered" | "skipped";

export type PosActionResult =
  | { status: "success" }
  | {
      status: "error";
      code:
        | "ORDER_NOT_FOUND"
        | "POS_COEXISTENCE_DISABLED"
        | "POS_REFERENCE_TOO_LONG";
      message: string;
    };

export const POS_COEXISTENCE_DISABLED_MESSAGE =
  "La coexistence avec la caisse n'est pas activée pour cet établissement.";

export type PosActor = {
  userId: string;
  role: StaffRole;
};

export type PosReconciliationDeps = {
  transaction: typeof db.transaction;
  now: () => Date;
};

const defaultDeps: PosReconciliationDeps = {
  transaction: db.transaction.bind(db),
  now: () => new Date(),
};

export async function markEnteredInPos(
  orderId: string,
  businessId: string,
  actor: PosActor,
  input: { posReference?: string } = {},
  deps = defaultDeps,
): Promise<PosActionResult> {
  const posReference = normalizePosReference(input.posReference);
  if ("status" in posReference) return posReference;

  return reconcilePosStatus(
    orderId,
    businessId,
    actor,
    {
      eventType: "order.pos_entered",
      payload: posReference.value ? { posReference: posReference.value } : {},
      updates: {
        posStatus: "entered",
        posEnteredAt: deps.now(),
        posEnteredByUserId: actor.userId,
        posReference: posReference.value,
      },
      idempotentStatus: "entered",
    },
    deps,
  );
}

export async function markSkippedInPos(
  orderId: string,
  businessId: string,
  actor: PosActor,
  input: { posReference?: string; reason?: string } = {},
  deps = defaultDeps,
): Promise<PosActionResult> {
  const posReference = normalizePosReference(input.posReference);
  if ("status" in posReference) return posReference;
  const reason = input.reason?.trim();

  return reconcilePosStatus(
    orderId,
    businessId,
    actor,
    {
      eventType: "order.pos_skipped",
      payload: {
        ...(posReference.value ? { posReference: posReference.value } : {}),
        ...(reason ? { reason } : {}),
      },
      updates: {
        posStatus: "skipped",
        posEnteredAt: null,
        posEnteredByUserId: null,
        posReference: posReference.value,
      },
      idempotentStatus: "skipped",
    },
    deps,
  );
}

export async function revertPosStatus(
  orderId: string,
  businessId: string,
  actor: PosActor,
  deps = defaultDeps,
): Promise<PosActionResult> {
  return deps.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.businessId, businessId)),
      columns: { id: true, posStatus: true },
    });
    if (!order) return notFound();
    if (order.posStatus === "not_required") return disabled();
    if (order.posStatus === "pending") return { status: "success" };

    await tx
      .update(orders)
      .set({
        posStatus: "pending",
        posEnteredAt: null,
        posEnteredByUserId: null,
        updatedAt: deps.now(),
      })
      .where(and(eq(orders.id, orderId), eq(orders.businessId, businessId)));

    await recordOrderEvent(orderId, "order.pos_reverted", {
      actor: { userId: actor.userId, role: actor.role },
      payload: {},
      tx,
    });

    return { status: "success" };
  });
}

type ReconcileSpec = {
  eventType: OrderEventType;
  payload: Record<string, unknown>;
  updates: {
    posStatus: PosStatus;
    posEnteredAt: Date | null;
    posEnteredByUserId: string | null;
    posReference: string | null;
  };
  idempotentStatus: PosStatus;
};

async function reconcilePosStatus(
  orderId: string,
  businessId: string,
  actor: PosActor,
  spec: ReconcileSpec,
  deps: PosReconciliationDeps,
): Promise<PosActionResult> {
  return deps.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.businessId, businessId)),
      columns: { id: true, posStatus: true },
    });
    if (!order) return notFound();
    if (order.posStatus === "not_required") return disabled();
    if (order.posStatus === spec.idempotentStatus) return { status: "success" };

    await tx
      .update(orders)
      .set({ ...spec.updates, updatedAt: deps.now() })
      .where(and(eq(orders.id, orderId), eq(orders.businessId, businessId)));

    await recordOrderEvent(orderId, spec.eventType, {
      actor: { userId: actor.userId, role: actor.role },
      payload: spec.payload,
      tx,
    });

    return { status: "success" };
  });
}

function normalizePosReference(
  raw: string | undefined,
): { ok: true; value: string | null } | Extract<PosActionResult, { status: "error" }> {
  const value = raw?.trim() ?? "";
  if (value.length > 64) {
    return {
      status: "error",
      code: "POS_REFERENCE_TOO_LONG",
      message: "La référence caisse doit faire 64 caractères maximum.",
    };
  }
  return { ok: true, value: value.length > 0 ? value : null };
}

function notFound(): PosActionResult {
  return {
    status: "error",
    code: "ORDER_NOT_FOUND",
    message: "Commande introuvable",
  };
}

function disabled(): PosActionResult {
  return {
    status: "error",
    code: "POS_COEXISTENCE_DISABLED",
    message: POS_COEXISTENCE_DISABLED_MESSAGE,
  };
}
