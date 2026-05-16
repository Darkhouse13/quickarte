export type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string | null;
};

export type PushPayload = {
  title: string;
  body: string;
  badge?: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
};

export type OrderSummary = {
  id: string;
  total: number;
  itemCount: number;
  tableNumber: string | null;
  type: "dine_in" | "takeaway" | "delivery";
};
