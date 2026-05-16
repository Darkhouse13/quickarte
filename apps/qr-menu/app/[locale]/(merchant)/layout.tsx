import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";
import { MerchantNav } from "@/components/ui/merchant-nav";
import { getCurrentBusiness } from "@/lib/auth/get-business";
import { getOrderStats } from "@/lib/ordering/queries";
import { hasEntitlement } from "@/lib/entitlements/queries";
import { getEntitlements } from "@/lib/entitlements/queries";
import { getStaffRole, type StaffRole } from "@/lib/identity/permissions";
import { ServiceWorkerRegister } from "@/components/merchant/sw-register";
import { InstallPrompt } from "@/components/merchant/install-prompt";
import { MERCHANT_BOTTOM_NAV_CLEARANCE_PX } from "@/lib/layout/merchant-bottom-nav";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function safeHasEntitlement(
  businessId: string,
  module: Parameters<typeof hasEntitlement>[1],
): Promise<boolean> {
  try {
    return await hasEntitlement(businessId, module);
  } catch (err) {
    console.error(`[layout] hasEntitlement(${module}) failed:`, err);
    return false;
  }
}

async function safePendingCount(businessId: string): Promise<number> {
  try {
    const stats = await getOrderStats(businessId);
    return stats.pendingCount;
  } catch (err) {
    console.error("[layout] getOrderStats failed:", err);
    return 0;
  }
}

async function safeCurrent(): Promise<{
  businessId: string | undefined;
  orderingEnabled: boolean;
  loyaltyEnabled: boolean;
  analyticsEnabled: boolean;
  userId: string | undefined;
  userEmail: string | undefined;
}> {
  try {
    const current = await getCurrentBusiness();
    return {
      businessId: current?.business?.id,
      orderingEnabled: current?.business?.settings?.orderingEnabled !== false,
      loyaltyEnabled: current?.business?.settings?.loyaltyEnabled !== false,
      analyticsEnabled: current?.business?.settings?.analyticsEnabled !== false,
      userId: current?.session.user.id,
      userEmail: current?.session.user.email,
    };
  } catch (err) {
    console.error("[layout] getCurrentBusiness failed:", err);
    return {
      businessId: undefined,
      orderingEnabled: false,
      loyaltyEnabled: false,
      analyticsEnabled: false,
      userId: undefined,
      userEmail: undefined,
    };
  }
}

async function safeStaffRole(
  userId: string | undefined,
  businessId: string | undefined,
): Promise<StaffRole | null> {
  if (!userId || !businessId) return null;
  try {
    return await getStaffRole(userId, businessId);
  } catch (err) {
    console.error("[layout] getStaffRole failed:", err);
    return null;
  }
}

export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { businessId, orderingEnabled, loyaltyEnabled, analyticsEnabled, userId, userEmail } =
    await safeCurrent();

  const role = await safeStaffRole(userId, businessId);

  // Kitchen-role staff log in once and stay on the kitchen view all shift —
  // the kitchen surface lives outside this (merchant) layout, so any kitchen
  // user reaching this layout is on the wrong page. Send them to /kitchen.
  if (role === "kitchen") redirect("/kitchen");

  if (userId) {
    Sentry.setUser({ id: userId, email: userEmail });
  } else {
    Sentry.setUser(null);
  }

  const [showOrdersEntitled, showLoyaltyEntitled, pendingOrders, entitlements] = businessId
    ? await Promise.all([
        safeHasEntitlement(businessId, "online_ordering"),
        safeHasEntitlement(businessId, "loyalty"),
        safePendingCount(businessId),
        getEntitlements(businessId).catch(() => null),
      ])
    : [false, false, 0, null];
  const showOrders = Boolean(showOrdersEntitled && orderingEnabled);
  const showLoyalty = Boolean(showLoyaltyEntitled && loyaltyEnabled);

  // Install prompt is only valuable for merchants using modules beyond the
  // static QR menu — they're the ones who actually work from the app daily.
  const hasInstallableEntitlement = entitlements
    ? (entitlements.online_ordering && orderingEnabled) ||
      (entitlements.loyalty && loyaltyEnabled) ||
      (entitlements.analytics && analyticsEnabled)
    : false;

  return (
    <main
      className="w-full max-w-[480px] mx-auto bg-base min-h-screen relative flex flex-col border-x border-outline/50 shadow-2xl shadow-black/5"
      style={{ paddingBottom: `${MERCHANT_BOTTOM_NAV_CLEARANCE_PX}px` }}
    >
      <ServiceWorkerRegister />
      {children}
      {hasInstallableEntitlement ? <InstallPrompt /> : null}
      <MerchantNav
        pendingOrders={showOrders ? pendingOrders : 0}
        showOrders={showOrders}
        showLoyalty={showLoyalty}
        showKitchen={role === "owner" || role === "manager"}
        showClose={role === "owner" || role === "manager" || role === "cashier"}
      />
    </main>
  );
}
