import "server-only";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  loyaltyCustomers,
  loyaltyPrograms,
  loyaltyTransactions,
  type LoyaltyCustomer,
  type LoyaltyProgram,
  type LoyaltyTransaction,
} from "@/lib/db/schema";

export async function getProgram(
  businessId: string,
): Promise<LoyaltyProgram | null> {
  const row = await db.query.loyaltyPrograms.findFirst({
    where: eq(loyaltyPrograms.businessId, businessId),
  });
  return row ?? null;
}

export async function findCustomerByPhone(
  businessId: string,
  phone: string,
): Promise<LoyaltyCustomer | null> {
  const row = await db.query.loyaltyCustomers.findFirst({
    where: and(
      eq(loyaltyCustomers.businessId, businessId),
      eq(loyaltyCustomers.phone, phone),
    ),
  });
  return row ?? null;
}

export type ListCustomersOptions = {
  limit?: number;
  offset?: number;
  search?: string;
};

export async function listCustomers(
  businessId: string,
  { limit = 20, offset = 0, search }: ListCustomersOptions = {},
): Promise<{ customers: LoyaltyCustomer[]; total: number }> {
  const searchTrimmed = search?.trim() ?? "";
  const filters = [eq(loyaltyCustomers.businessId, businessId)];
  if (searchTrimmed.length > 0) {
    const like = `%${searchTrimmed}%`;
    const matcher = or(
      ilike(loyaltyCustomers.phone, like),
      ilike(loyaltyCustomers.name, like),
    );
    if (matcher) filters.push(matcher);
  }
  const where = and(...filters);

  const customers = await db
    .select()
    .from(loyaltyCustomers)
    .where(where)
    .orderBy(desc(loyaltyCustomers.lastVisitAt))
    .limit(limit)
    .offset(offset);

  const [count] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(loyaltyCustomers)
    .where(where);

  return { customers, total: count?.c ?? 0 };
}

export async function listTransactions(
  customerId: string,
  { limit = 20 }: { limit?: number } = {},
): Promise<LoyaltyTransaction[]> {
  return await db
    .select()
    .from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.customerId, customerId))
    .orderBy(desc(loyaltyTransactions.createdAt))
    .limit(limit);
}

export async function countNewCustomersLast24h(
  businessId: string,
): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(loyaltyCustomers)
    .where(
      and(
        eq(loyaltyCustomers.businessId, businessId),
        sql`${loyaltyCustomers.createdAt} >= ${since}`,
      ),
    );
  return row?.c ?? 0;
}
