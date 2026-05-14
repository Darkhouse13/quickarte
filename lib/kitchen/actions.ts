"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth/get-business";
import { assertRole, type StaffRole } from "@/lib/identity/permissions";
import { transitionOrder } from "@/lib/ordering/transitions";
import type { OrderLifecycleStatus } from "@/lib/ordering/status";
import {
  getOpenKitchenOrders,
  type KitchenOrder,
} from "./queries";

const KITCHEN_ROLES: StaffRole[] = ["owner", "manager", "kitchen"];

export type KitchenSnapshot = {
  status: "success";
  orders: KitchenOrder[];
  fetchedAt: string;
};

export type KitchenSnapshotResult =
  | KitchenSnapshot
  | { status: "error"; message: string };

export async function fetchKitchenSnapshot(): Promise<KitchenSnapshotResult> {
  try {
    const { session, business } = await requireBusiness();
    await assertRole(session.user.id, business.id, KITCHEN_ROLES);
    const list = await getOpenKitchenOrders(business.id);
    return { status: "success", orders: list, fetchedAt: new Date().toISOString() };
  } catch (err) {
    console.error("[kitchen] fetchKitchenSnapshot failed:", err);
    return { status: "error", message: "Impossible de charger les commandes." };
  }
}

export type KitchenActionResult =
  | { status: "success"; order: KitchenOrder }
  | { status: "error"; message: string };

async function kitchenTransition(
  orderId: string,
  toStatus: OrderLifecycleStatus,
): Promise<KitchenActionResult> {
  const { session, business } = await requireBusiness();
  const role = await assertRole(session.user.id, business.id, KITCHEN_ROLES);

  const result = await transitionOrder(
    orderId,
    toStatus,
    { userId: session.user.id, role },
    { businessId: business.id },
  );
  if (result.status === "not_found") {
    return { status: "error", message: "Commande introuvable." };
  }
  if (result.status === "invalid_transition") {
    return { status: "error", message: "Transition impossible pour cette commande." };
  }

  revalidatePath("/kitchen");
  revalidatePath("/orders");

  const refreshed = await getOpenKitchenOrders(business.id);
  const order = refreshed.find((o) => o.id === orderId);
  if (!order) {
    return { status: "error", message: "Commande introuvable après mise à jour." };
  }
  return { status: "success", order };
}

// "Accepter" moves an order from pending (or confirmed) directly into the
// preparing column. transitionOrder records an order.preparing event — we
// never write the orders table directly from the kitchen surface.
export async function kitchenAcceptOrder(
  orderId: string,
): Promise<KitchenActionResult> {
  return kitchenTransition(orderId, "preparing");
}

export async function kitchenMarkReady(
  orderId: string,
): Promise<KitchenActionResult> {
  return kitchenTransition(orderId, "ready");
}
