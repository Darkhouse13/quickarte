import "server-only";

import { and, asc, count, eq, gte, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, categoryPrintRoutes, printJobs, printers } from "@/lib/db/schema";
import { recordOrderEvent } from "@/lib/ordering/events";
import { nextFailureState } from "@/lib/printing/format";
export {
  formatTestPrintPayload,
  generateWebprintToken,
  nextFailureState,
} from "@/lib/printing/format";
import type { TicketOrder } from "@/lib/printing/ticket";
import { splitOrderItemsByStation } from "@/lib/printing/routing";
import { buildPrintJobsForEnabledPrinters } from "@/lib/printing/job-builder";

const POLL_LIMIT = 20;
const POLL_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type PrinterConnectionType =
  | "manual"
  | "webprint"
  | "escpos_lan"
  | "escpos_usb";
export type PrinterStation = "counter" | "kitchen" | "bar";

export type PrintJobPollingResponse = {
  printer: { id: string; name: string; station: PrinterStation };
  jobs: {
    id: string;
    payload_text: string;
    created_at: string;
    order_id: string | null;
    attempts: number;
  }[];
};

export type PrintRouteResult<T> =
  | { status: "ok"; data: T }
  | { status: "not_found" };

type TransactionLike = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function enqueuePrintJobsForOrder(
  orderId: string,
  businessId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    await db.transaction(async (tx) => {
      const order = await tx.query.orders.findFirst({
        where: (table, { and: txAnd, eq: txEq }) =>
          txAnd(txEq(table.id, orderId), txEq(table.businessId, businessId)),
        with: {
          items: {
            with: {
              product: { columns: { name: true, categoryId: true } },
            },
          },
        },
      });
      if (!order) throw new Error("Order not found for print enqueue");

      const enabledPrinters = await tx.query.printers.findMany({
        where: and(
          eq(printers.businessId, businessId),
          eq(printers.enabled, true),
          isNull(printers.deletedAt),
        ),
        orderBy: (table, { asc: txAsc }) => [txAsc(table.createdAt)],
      });
      if (enabledPrinters.length === 0) return;

      const itemsByStation = await splitOrderItemsByStation(
        order.items,
        businessId,
        tx,
      );
      const jobs = buildPrintJobsForEnabledPrinters(
        order as TicketOrder,
        enabledPrinters,
        itemsByStation,
      );

      if (jobs.length === 0) return;

      await tx.insert(printJobs).values(jobs);
    });

    const [result] = await db
      .select({ value: count() })
      .from(printJobs)
      .where(eq(printJobs.orderId, orderId));
    return { ok: true, count: result?.value ?? 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown print error";
    try {
      await recordOrderEvent(orderId, "order.printed", {
        actor: { userId: null, role: "system" },
        payload: { status: "enqueue_failed", error: message },
      });
    } catch (eventErr) {
      console.error("[printing] failed to record enqueue failure:", eventErr);
    }
    return { ok: false, error: message };
  }
}

export async function getPrinterSettings(businessId: string) {
  const rows = await db
    .select({
      id: printers.id,
      name: printers.name,
      station: printers.station,
      connectionType: printers.connectionType,
      address: printers.address,
      webprintToken: printers.webprintToken,
      lastSeenAt: printers.lastSeenAt,
      enabled: printers.enabled,
      pendingCount: sql<number>`count(${printJobs.id})::int`,
    })
    .from(printers)
    .leftJoin(
      printJobs,
      and(eq(printJobs.printerId, printers.id), eq(printJobs.status, "pending")),
    )
    .where(and(eq(printers.businessId, businessId), isNull(printers.deletedAt)))
    .groupBy(printers.id)
    .orderBy(asc(printers.createdAt));

  return rows.map((row) => ({
    ...row,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    connectionType: row.connectionType as PrinterConnectionType,
    station: row.station as PrinterStation,
  }));
}

export async function getPrinterRoutingSettings(businessId: string) {
  const [categoryRows, routeRows, printerRows] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
      })
      .from(categories)
      .where(eq(categories.businessId, businessId))
      .orderBy(asc(categories.position), asc(categories.name)),
    db
      .select({
        categoryId: categoryPrintRoutes.categoryId,
        station: categoryPrintRoutes.station,
      })
      .from(categoryPrintRoutes)
      .where(eq(categoryPrintRoutes.businessId, businessId)),
    db
      .select({
        station: printers.station,
        count: sql<number>`count(${printers.id})::int`,
      })
      .from(printers)
      .where(
        and(
          eq(printers.businessId, businessId),
          eq(printers.enabled, true),
          isNull(printers.deletedAt),
        ),
      )
      .groupBy(printers.station),
  ]);

  const stationPrinterCounts: Record<PrinterStation, number> = {
    counter: 0,
    kitchen: 0,
    bar: 0,
  };
  for (const row of printerRows) {
    stationPrinterCounts[row.station as PrinterStation] = row.count;
  }

  const categoryNamesByStation: Record<PrinterStation, string[]> = {
    counter: [],
    kitchen: [],
    bar: [],
  };
  const categoryNameById = new Map(categoryRows.map((row) => [row.id, row.name]));
  for (const route of routeRows) {
    const name = categoryNameById.get(route.categoryId);
    if (name) categoryNamesByStation[route.station as PrinterStation].push(name);
  }

  return {
    categories: categoryRows,
    routes: routeRows.map((row) => ({
      categoryId: row.categoryId,
      station: row.station as PrinterStation,
    })),
    stationPrinterCounts,
    categoryNamesByStation,
  };
}

export async function pollPrintJobs(
  token: string,
): Promise<PrintRouteResult<PrintJobPollingResponse>> {
  const printer = await findWebprintPrinterByToken(token);
  if (!printer) return { status: "not_found" };

  await touchPrinter(printer.id);

  const cutoff = new Date(Date.now() - POLL_MAX_AGE_MS);
  const jobs = await db.query.printJobs.findMany({
    where: and(
      eq(printJobs.printerId, printer.id),
      eq(printJobs.status, "pending"),
      gte(printJobs.createdAt, cutoff),
    ),
    orderBy: (table, { asc: txAsc }) => [txAsc(table.createdAt)],
    limit: POLL_LIMIT,
  });

  return {
    status: "ok",
    data: {
      printer: {
        id: printer.id,
        name: printer.name,
        station: printer.station as PrinterStation,
      },
      jobs: jobs.map((job) => ({
        id: job.id,
        payload_text: job.payloadText,
        created_at: job.createdAt.toISOString(),
        order_id: job.orderId,
        attempts: job.attempts,
      })),
    },
  };
}

export async function markPrintJobPrinted(
  jobId: string,
  token: string,
): Promise<PrintRouteResult<{ id: string }>> {
  return db.transaction(async (tx) => {
    const printer = await findWebprintPrinterByToken(token, tx);
    if (!printer) return { status: "not_found" };

    const job = await tx.query.printJobs.findFirst({
      where: and(eq(printJobs.id, jobId), eq(printJobs.printerId, printer.id)),
    });
    if (!job) return { status: "not_found" };

    await touchPrinter(printer.id, tx);

    const [updated] = await tx
      .update(printJobs)
      .set({ status: "printed", printedAt: new Date(), lastError: null })
      .where(and(eq(printJobs.id, job.id), ne(printJobs.status, "printed")))
      .returning({ id: printJobs.id });

    if (!updated) {
      return { status: "ok", data: { id: job.id } };
    }

    if (job.orderId) {
      await recordOrderEvent(job.orderId, "order.printed", {
        actor: { userId: null, role: "system" },
        payload: {
          print_job_id: job.id,
          printer_id: printer.id,
          status: "printed",
        },
        tx,
      });
    }

    return { status: "ok", data: { id: job.id } };
  });
}

export async function markPrintJobFailed(
  jobId: string,
  token: string,
  error: string,
): Promise<PrintRouteResult<{ id: string; attempts: number; status: string }>> {
  return db.transaction(async (tx) => {
    const printer = await findWebprintPrinterByToken(token, tx);
    if (!printer) return { status: "not_found" };

    const job = await tx.query.printJobs.findFirst({
      where: and(eq(printJobs.id, jobId), eq(printJobs.printerId, printer.id)),
    });
    if (!job) return { status: "not_found" };

    await touchPrinter(printer.id, tx);

    if (job.status === "printed" || job.status === "failed") {
      return {
        status: "ok",
        data: { id: job.id, attempts: job.attempts, status: job.status },
      };
    }

    const next = nextFailureState(job.attempts);
    const lastError = error.trim().slice(0, 500) || "Erreur inconnue";

    await tx
      .update(printJobs)
      .set({
        attempts: next.attempts,
        status: next.status,
        lastError,
      })
      .where(eq(printJobs.id, job.id));

    if (job.orderId) {
      await recordOrderEvent(job.orderId, "order.printed", {
        actor: { userId: null, role: "system" },
        payload: {
          print_job_id: job.id,
          printer_id: printer.id,
          status: "failed",
          attempts: next.attempts,
          error: lastError,
        },
        tx,
      });
    }

    return {
      status: "ok",
      data: { id: job.id, attempts: next.attempts, status: next.status },
    };
  });
}

async function findWebprintPrinterByToken(token: string, tx: TransactionLike | typeof db = db) {
  if (!token) return null;
  const printer = await tx.query.printers.findFirst({
    where: and(
      eq(printers.webprintToken, token),
      eq(printers.connectionType, "webprint"),
      eq(printers.enabled, true),
      isNull(printers.deletedAt),
    ),
  });
  return printer ?? null;
}

async function touchPrinter(printerId: string, tx: TransactionLike | typeof db = db) {
  await tx
    .update(printers)
    .set({ lastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(printers.id, printerId));
}
