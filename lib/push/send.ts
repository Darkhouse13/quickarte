import "server-only";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  pushSubscriptions,
  orderItems,
  orders,
} from "@/lib/db/schema";
import {
  getSubscriptionsForBusiness,
  markFailure,
  markSuccess,
  deleteSubscription,
} from "./queries";
import type { OrderSummary, PushPayload } from "./types";

const MAX_FAILURES_BEFORE_DELETE = 3;

function getVapidConfig():
  | { publicKey: string; privateKey: string; subject: string }
  | null {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const cfg = getVapidConfig();
  if (!cfg) return false;
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  vapidConfigured = true;
  return true;
}

function formatEuros(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")} €`;
}

function describeOrder(order: OrderSummary): string {
  const parts: string[] = [];
  if (order.type === "dine_in" && order.tableNumber) {
    parts.push(`Table ${order.tableNumber}`);
  } else if (order.type === "takeaway") {
    parts.push("À emporter");
  } else if (order.type === "delivery") {
    parts.push("Livraison");
  }
  parts.push(`${order.itemCount} article${order.itemCount > 1 ? "s" : ""}`);
  parts.push(formatEuros(order.total));
  return parts.join(" · ");
}

async function loadOrderSummary(orderId: string): Promise<OrderSummary | null> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    columns: {
      id: true,
      total: true,
      tableNumber: true,
      type: true,
    },
  });
  if (!order) return null;
  const items = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, orderId),
    columns: { quantity: true },
  });
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  return {
    id: order.id,
    total: Number(order.total),
    tableNumber: order.tableNumber,
    itemCount,
    type: order.type,
  };
}

async function sendToSubscription(
  subscription: typeof pushSubscriptions.$inferSelect,
  payload: PushPayload,
): Promise<"success" | "gone" | "failed"> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dhKey,
          auth: subscription.authKey,
        },
      },
      JSON.stringify(payload),
      { TTL: 60 },
    );
    await markSuccess(subscription.id);
    return "success";
  } catch (err: unknown) {
    const status =
      typeof err === "object" && err !== null && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    // 404/410 = the push service has revoked this subscription; drop it now
    // rather than waiting for three strikes.
    if (status === 404 || status === 410) {
      await deleteSubscription(subscription.id);
      return "gone";
    }
    const failures = await markFailure(subscription.id);
    if (failures >= MAX_FAILURES_BEFORE_DELETE) {
      await deleteSubscription(subscription.id);
    }
    console.error(
      `[push] send failed (status=${status ?? "?"}, failures=${failures}):`,
      err,
    );
    return "failed";
  }
}

export async function sendRawPayload(
  businessId: string,
  payload: PushPayload,
): Promise<{ delivered: number; removed: number; failed: number }> {
  try {
    if (!ensureVapid()) {
      console.warn("[push] VAPID keys not configured, skipping send");
      return { delivered: 0, removed: 0, failed: 0 };
    }
    const subs = await getSubscriptionsForBusiness(businessId);
    let delivered = 0;
    let removed = 0;
    let failed = 0;
    await Promise.all(
      subs.map(async (s) => {
        const result = await sendToSubscription(s, payload);
        if (result === "success") delivered++;
        else if (result === "gone") removed++;
        else failed++;
      }),
    );
    return { delivered, removed, failed };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "push-send" },
      extra: { businessId, title: payload.title },
    });
    throw err;
  }
}

export async function sendOrderNotification(
  businessId: string,
  orderId: string,
): Promise<void> {
  if (!ensureVapid()) return;
  const summary = await loadOrderSummary(orderId);
  if (!summary) return;
  const payload: PushPayload = {
    title: "Nouvelle commande",
    body: describeOrder(summary),
    badge: "/icons/badge-72.png",
    icon: "/icons/icon-192.png",
    tag: `new-order-${summary.id}`,
    data: { orderId: summary.id, url: "/fr/orders" },
    requireInteraction: true,
  };
  await sendRawPayload(businessId, payload);
}

export async function sendTestNotification(
  businessId: string,
): Promise<{ delivered: number; removed: number; failed: number }> {
  const payload: PushPayload = {
    title: "Test Quickarte",
    body: "Si vous voyez ceci, les notifications fonctionnent.",
    badge: "/icons/badge-72.png",
    icon: "/icons/icon-192.png",
    tag: "test-notification",
    data: { url: "/fr/home" },
    requireInteraction: false,
  };
  return sendRawPayload(businessId, payload);
}
