import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { cafeDesArts } from "@/lib/catalog/fixtures";
import { StorefrontMenu } from "@/components/storefront/storefront-menu";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function StorefrontPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const business = slug === cafeDesArts.slug ? cafeDesArts : null;
  if (!business) notFound();

  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen relative flex flex-col border-x border-outline/50 shadow-2xl shadow-black/5">
      <StorefrontMenu business={business} />
    </main>
  );
}
