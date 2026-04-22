import * as Sentry from "@sentry/nextjs";
import { MerchantNav } from "@/components/ui/merchant-nav";
import { getCurrentBusiness } from "@/lib/auth/get-business";
import { getOrderStats } from "@/lib/ordering/queries";
import { hasEntitlement } from "@/lib/entitlements/queries";
import { getEntitlements } from "@/lib/entitlements/queries";
import { ServiceWorkerRegister } from "@/components/merchant/sw-register";
import { InstallPrompt } from "@/components/merchant/install-prompt";

export const dynamic = "force-dynamic";

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
  userId: string | undefined;
  userEmail: string | undefined;
}> {
  try {
    const current = await getCurrentBusiness();
    return {
      businessId: current?.business?.id,
      userId: current?.session.user.id,
      userEmail: current?.session.user.email,
    };
  } catch (err) {
    console.error("[layout] getCurrentBusiness failed:", err);
    return { businessId: undefined, userId: undefined, userEmail: undefined };
  }
}

export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { businessId, userId, userEmail } = await safeCurrent();

  if (userId) {
    Sentry.setUser({ id: userId, email: userEmail });
  } else {
    Sentry.setUser(null);
  }

  const [showOrders, showLoyalty, pendingOrders, entitlements] = businessId
    ? await Promise.all([
        safeHasEntitlement(businessId, "online_ordering"),
        safeHasEntitlement(businessId, "loyalty"),
        safePendingCount(businessId),
        getEntitlements(businessId).catch(() => null),
      ])
    : [false, false, 0, null];

  // Install prompt is only valuable for merchants using modules beyond the
  // static QR menu — they're the ones who actually work from the app daily.
  const hasInstallableEntitlement = entitlements
    ? entitlements.online_ordering ||
      entitlements.loyalty ||
      entitlements.analytics
    : false;

  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen relative flex flex-col border-x border-outline/50 shadow-2xl shadow-black/5 pb-24">
      <ServiceWorkerRegister />
      {children}
      {hasInstallableEntitlement ? <InstallPrompt /> : null}
      <MerchantNav
        pendingOrders={showOrders ? pendingOrders : 0}
        showOrders={showOrders}
        showLoyalty={showLoyalty}
      />
    </main>
  );
}
