import { MerchantNav } from "@/components/ui/merchant-nav";

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen relative flex flex-col border-x border-outline/50 shadow-2xl shadow-black/5 pb-24">
      {children}
      <MerchantNav />
    </main>
  );
}
