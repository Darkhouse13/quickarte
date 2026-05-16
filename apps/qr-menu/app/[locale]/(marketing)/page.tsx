import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/auth/get-business";
import { LandingPage } from "@/components/marketing/landing-page";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Quickarte — L'OS commerçant",
  description: "L'OS commerçant, simple et puissant.",
};

export default async function MarketingRootPage() {
  const current = await getCurrentBusiness();
  if (current) redirect(current.business ? "/home" : "/onboarding");

  return <LandingPage />;
}
