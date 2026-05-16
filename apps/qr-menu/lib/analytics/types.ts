export type AnalyticsRange = "7d" | "30d";

export type AnalyticsSummary = {
  revenue: number;
  orderCount: number;
  avgTicket: number;
  newLoyaltyCustomers: number;
  revenueDeltaPct: number | null;
  bestDayOfWeek: string | null;
};

export type RevenueByDayPoint = {
  date: string;
  revenue: number;
  orderCount: number;
};

export type ProductPerformanceEntry = {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
};

export type ProductPerformance = {
  top: ProductPerformanceEntry[];
  bottom: ProductPerformanceEntry[];
};

export type HeatmapCell = {
  dayOfWeek: number;
  hour: number;
  orderCount: number;
};

export type TopLoyalCustomer = {
  customerId: string;
  name: string | null;
  phoneDisplay: string;
  lifetimeEarned: number;
  balance: number;
  lastVisitAt: Date | null;
};
