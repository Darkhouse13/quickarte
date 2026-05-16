import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { printers } from "@quickarte/db-schema";

type TransactionLike = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getOrCreateDefaultCounterPrinter(
  tx: TransactionLike,
  businessId: string,
) {
  const existing = await tx.query.printers.findFirst({
    where: and(
      eq(printers.businessId, businessId),
      eq(printers.station, "counter"),
      eq(printers.connectionType, "manual"),
      eq(printers.enabled, true),
      isNull(printers.deletedAt),
    ),
  });
  if (existing) return existing;

  const [created] = await tx
    .insert(printers)
    .values({
      businessId,
      name: "Comptoir",
      station: "counter",
      connectionType: "manual",
      enabled: true,
    })
    .returning();
  return created ?? null;
}

export async function ensureDefaultCounterPrinter(
  businessId: string,
  tx: TransactionLike,
): Promise<string> {
  const printer = await getOrCreateDefaultCounterPrinter(tx, businessId);
  if (!printer) throw new Error("Failed to create default printer");
  return printer.id;
}
