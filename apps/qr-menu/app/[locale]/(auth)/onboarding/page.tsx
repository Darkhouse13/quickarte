import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getCurrentBusiness } from "@/lib/auth/get-business";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte — Création" };

type Props = { params: Promise<{ locale: string }> };

export default async function OnboardingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const result = await getCurrentBusiness();
  if (!result) redirect("/login");
  if (result.business) redirect("/home");

  return <OnboardingForm />;
}
