import { getCurrentBusiness } from "@/lib/auth/get-business";
import { getStaffRole } from "@/lib/identity/permissions";
import { redirect } from "next/navigation";
import { KitchenForbidden } from "@/components/kitchen/kitchen-forbidden";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function KitchenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await getCurrentBusiness();
  if (!result) redirect("/login");
  if (!result.business) redirect("/onboarding");

  const role = await getStaffRole(result.session.user.id, result.business.id);
  const allowed = role === "owner" || role === "manager" || role === "kitchen";

  return (
    <main className="bg-base text-ink min-h-screen w-full flex flex-col">
      {allowed ? children : <KitchenForbidden />}
    </main>
  );
}
