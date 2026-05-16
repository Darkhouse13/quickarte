"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { categories, categoryPrintRoutes, printJobs, printers } from "@quickarte/db-schema";
import { requireBusiness } from "@/lib/auth/get-business";
import { assertRole } from "@/lib/identity/permissions";
import { recordOrderEvent } from "@/lib/ordering/events";
import { getOrCreateDefaultCounterPrinter } from "@/lib/printing/printers";
import {
  formatTestPrintPayload,
  generateWebprintToken,
  type PrinterConnectionType,
  type PrinterStation,
} from "@/lib/printing/pipeline";
import { renderTicket, type TicketOrder } from "@/lib/printing/ticket";

export type EnqueuePrintJobResult =
  | { status: "success"; jobId: string; payloadText: string; manual: boolean }
  | { status: "error"; message: string };

export async function enqueuePrintJob(
  orderId: string,
  printerId?: string,
): Promise<EnqueuePrintJobResult> {
  const { session, business } = await requireBusiness();
  const role = await assertRole(session.user.id, business.id, [
    "owner",
    "manager",
    "cashier",
  ]);

  return db.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({
      where: (table, { and: txAnd, eq: txEq }) =>
        txAnd(txEq(table.id, orderId), txEq(table.businessId, business.id)),
      with: {
        items: {
          with: {
            product: { columns: { name: true } },
          },
        },
      },
    });
    if (!order) return { status: "error", message: "Commande introuvable" };

    const printer = printerId
      ? await tx.query.printers.findFirst({
          where: and(
            eq(printers.id, printerId),
            eq(printers.businessId, business.id),
            eq(printers.enabled, true),
            isNull(printers.deletedAt),
          ),
        })
      : await getOrCreateDefaultCounterPrinter(tx, business.id);

    if (!printer) {
      return { status: "error", message: "Imprimante introuvable" };
    }

    // Manual print/reprint is the cashier's escape hatch: it always prints the
    // full order, regardless of station routing.
    const payloadText = renderTicket(order as TicketOrder);
    const [prior] = await tx
      .select({ value: count() })
      .from(printJobs)
      .where(eq(printJobs.orderId, order.id));
    const eventType = (prior?.value ?? 0) > 0 ? "order.reprinted" : "order.printed";
    const now = new Date();
    const [job] = await tx
      .insert(printJobs)
      .values({
        orderId: order.id,
        printerId: printer.id,
        status: printer.connectionType === "manual" ? "manual" : "pending",
        attempts: 0,
        payloadText,
        printedAt: printer.connectionType === "manual" ? now : null,
      })
      .returning({ id: printJobs.id });

    if (!job) return { status: "error", message: "Impression impossible" };

    await recordOrderEvent(order.id, eventType, {
      actor: { userId: session.user.id, role },
      payload: { print_job_id: job.id, printer_id: printer.id },
      tx,
    });

    return {
      status: "success",
      jobId: job.id,
      payloadText,
      manual: printer.connectionType === "manual",
    };
  });
}

export type PrinterActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export async function createPrinter(input: {
  name: string;
  station: PrinterStation;
  connectionType: PrinterConnectionType;
  address?: string;
}): Promise<PrinterActionResult> {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Nom requis" };

  const now = new Date();
  await db.insert(printers).values({
    businessId: business.id,
    name,
    station: input.station,
    connectionType: input.connectionType,
    address: input.address?.trim() || null,
    webprintToken:
      input.connectionType === "webprint" ? generateWebprintToken() : null,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/settings/printers");
  return { ok: true };
}

export async function updatePrinter(input: {
  id: string;
  name?: string;
  station?: PrinterStation;
  enabled?: boolean;
}): Promise<PrinterActionResult> {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);

  const existing = await db.query.printers.findFirst({
    where: and(
      eq(printers.id, input.id),
      eq(printers.businessId, business.id),
      isNull(printers.deletedAt),
    ),
  });
  if (!existing) return { ok: false, error: "Imprimante introuvable" };

  const nextName = input.name?.trim();
  if (input.name !== undefined && !nextName) {
    return { ok: false, error: "Nom requis" };
  }

  await db
    .update(printers)
    .set({
      name: nextName ?? existing.name,
      station: input.station ?? existing.station,
      enabled: input.enabled ?? existing.enabled,
      updatedAt: new Date(),
    })
    .where(eq(printers.id, existing.id));

  revalidatePath("/settings/printers");
  return { ok: true };
}

export async function regenerateWebprintToken(
  printerId: string,
): Promise<PrinterActionResult> {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);

  const [updated] = await db
    .update(printers)
    .set({
      webprintToken: generateWebprintToken(),
      lastSeenAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(printers.id, printerId),
        eq(printers.businessId, business.id),
        eq(printers.connectionType, "webprint"),
        isNull(printers.deletedAt),
      ),
    )
    .returning({ id: printers.id });

  if (!updated) return { ok: false, error: "Imprimante introuvable" };
  revalidatePath("/settings/printers");
  return { ok: true };
}

export async function deletePrinter(printerId: string): Promise<PrinterActionResult> {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);

  const [updated] = await db
    .update(printers)
    .set({ enabled: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(printers.id, printerId),
        eq(printers.businessId, business.id),
        isNull(printers.deletedAt),
      ),
    )
    .returning({ id: printers.id });

  if (!updated) return { ok: false, error: "Imprimante introuvable" };
  revalidatePath("/settings/printers");
  return { ok: true };
}

export async function enqueueTestPrint(
  printerId: string,
): Promise<PrinterActionResult> {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);

  const printer = await db.query.printers.findFirst({
    where: and(
      eq(printers.id, printerId),
      eq(printers.businessId, business.id),
      eq(printers.enabled, true),
      isNull(printers.deletedAt),
    ),
  });
  if (!printer) return { ok: false, error: "Imprimante introuvable" };

  await db.insert(printJobs).values({
    orderId: null,
    printerId: printer.id,
    status: printer.connectionType === "manual" ? "manual" : "pending",
    attempts: 0,
    payloadText: formatTestPrintPayload(),
    printedAt: printer.connectionType === "manual" ? new Date() : null,
  });

  revalidatePath("/settings/printers");
  return { ok: true, message: "Test ajoute a la file d'impression" };
}

export async function setCategoryRoute(input: {
  categoryId: string;
  station: PrinterStation;
  enabled: boolean;
}): Promise<PrinterActionResult> {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);

  const category = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, input.categoryId),
      eq(categories.businessId, business.id),
    ),
    columns: { id: true },
  });
  if (!category) return { ok: false, error: "Categorie introuvable" };

  if (input.enabled) {
    await db
      .insert(categoryPrintRoutes)
      .values({
        businessId: business.id,
        categoryId: category.id,
        station: input.station,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  } else {
    await db
      .delete(categoryPrintRoutes)
      .where(
        and(
          eq(categoryPrintRoutes.businessId, business.id),
          eq(categoryPrintRoutes.categoryId, category.id),
          eq(categoryPrintRoutes.station, input.station),
        ),
      );
  }

  revalidatePath("/settings/printers");
  return { ok: true };
}
