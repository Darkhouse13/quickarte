import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loyaltyPrograms, orders } from "@quickarte/db-schema";
import { applyCreditTransaction } from "@/lib/loyalty/credits";

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
