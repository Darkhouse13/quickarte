import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getCurrentBusiness } from "@/lib/auth/get-business";
import { LandingPage } from "@/components/marketing/landing-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function IndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const result = await getCurrentBusiness();
  if (result) {
    if (!result.business) redirect("/onboarding");
    redirect("/home");
  }

  return <LandingPage />;
}
