import { MerchantNav } from "@/components/ui/merchant-nav";
import { getCurrentBusiness } from "@/lib/auth/get-business";
import { getOrderStats } from "@/lib/ordering/queries";

export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentBusiness();
  const pendingOrders =
    current?.business
      ? (await getOrderStats(current.business.id)).pendingCount
      : 0;

  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen relative flex flex-col border-x border-outline/50 shadow-2xl shadow-black/5 pb-24">
      {children}
      <MerchantNav pendingOrders={pendingOrders} />
    </main>
  );
}
