import {
  DEFAULT_BUSINESS_TIMEZONE,
  getBusinessDayBoundsForDateString,
  parseBusinessDateParam,
} from "@/lib/business/business-day";
import type { StaffRole } from "@/lib/identity/permissions";
import { CLOSE_OF_DAY_ROLES, isForbiddenRoleError } from "./close-of-day-access";
import { buildCloseCsv, streamCloseCsv } from "./close-of-day-csv";
import { getDailyClose, type DailyClose } from "./close-of-day";
import {
  getOrdersForDay,
  parsePosStatusFilter,
  parseOrderStatusFilters,
  type OrderListItem,
  type OrderListItemFilters,
} from "./close-of-day-orders";

type CloseCurrentBusiness = {
  session: { user: { id: string } };
  business: {
    id: string;
    slug: string;
    timezone: string;
    settings?: {
      posCoexistenceEnabled?: boolean | null;
    } | null;
  } | null;
} | null;

export type CloseExportDeps = {
  getCurrentBusiness: () => Promise<CloseCurrentBusiness>;
  assertRole: (
    userId: string,
    businessId: string,
    allowed: StaffRole[],
  ) => Promise<StaffRole>;
  getDailyClose: typeof getDailyClose;
  getOrdersForDay: typeof getOrdersForDay;
};

export const defaultCloseExportDeps: CloseExportDeps = {
  getCurrentBusiness: async () => {
    const { getCurrentBusiness } = await import("@/lib/auth/get-business");
    return getCurrentBusiness();
  },
  assertRole: async (userId, businessId, allowed) => {
    const { assertRole } = await import("@/lib/identity/permissions");
    return assertRole(userId, businessId, allowed);
  },
  getDailyClose,
  getOrdersForDay,
};

export async function handleCloseExport(
  request: Request,
  deps: CloseExportDeps = defaultCloseExportDeps,
): Promise<Response> {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  if (!dateParam || !parseBusinessDateParam(dateParam)) {
    return textResponse("Date invalide. Utilisez le format AAAA-MM-JJ.", 400);
  }

  const current = await deps.getCurrentBusiness();
  if (!current) return textResponse("Connexion requise.", 401);
  if (!current.business) return textResponse("Entreprise introuvable.", 403);

  try {
    await deps.assertRole(
      current.session.user.id,
      current.business.id,
      CLOSE_OF_DAY_ROLES,
    );
  } catch (error) {
    if (isForbiddenRoleError(error)) {
      return textResponse("Accès refusé pour cette clôture.", 403);
    }
    throw error;
  }

  const timezone = current.business.timezone || DEFAULT_BUSINESS_TIMEZONE;
  const bounds = getBusinessDayBoundsForDateString(dateParam, timezone);
  if (!bounds) throw new Error("Unable to compute close-of-day bounds");

  const filters = filtersFromSearchParams(url.searchParams);
  const [dailyClose, orders] = await Promise.all([
    deps.getDailyClose(current.business.id, bounds, { timezone }),
    deps.getOrdersForDay(current.business.id, bounds, filters, { sort: "asc" }),
  ]);

  const csvInput = {
    orders,
    totals: {
      revenueMad: dailyClose.totals.revenueMad,
      orderCount: dailyClose.totals.orderCount,
    },
    business: {
      posCoexistenceEnabled:
        current.business.settings?.posCoexistenceEnabled === true,
    },
    timezone,
  };

  return csvResponse({
    csv: orders.length > 500 ? streamCloseCsv(csvInput) : buildCloseCsv(csvInput),
    businessSlug: current.business.slug,
    dateParam,
  });
}

export function filtersFromSearchParams(
  searchParams: URLSearchParams,
): OrderListItemFilters {
  const statusIn = parseOrderStatusFilters(searchParams.getAll("statusIn"));
  const tableNumberQuery =
    searchParams.get("tableNumberQuery")?.trim() || undefined;
  const posStatus = parsePosStatusFilter(searchParams.get("posStatus"));
  return { statusIn, posStatus, tableNumberQuery };
}

function csvResponse({
  csv,
  businessSlug,
  dateParam,
}: {
  csv: BodyInit;
  businessSlug: string;
  dateParam: string;
}): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quickarte-cloture-${sanitizeFilenamePart(
        businessSlug,
      )}-${dateParam}.csv"`,
    },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function sanitizeFilenamePart(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "business";
}

export type CloseExportTestData = {
  dailyClose: DailyClose;
  orders: OrderListItem[];
};
