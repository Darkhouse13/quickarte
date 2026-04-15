import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { StorefrontMenu } from "@/components/storefront/storefront-menu";
import {
  getBusinessBySlug,
  getMenuByBusinessId,
} from "@/lib/catalog/queries";
import type { StorefrontFixture } from "@/lib/catalog/fixtures";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) return { title: "Quickarte" };
  const location = [business.city, business.address]
    .filter(Boolean)
    .join(" · ");
  return {
    title: `${business.name} — Menu`,
    description: location
      ? `${business.name} — ${location}`
      : `${business.name} — Menu`,
  };
}

export default async function StorefrontPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const menu = await getMenuByBusinessId(business.id);

  const location = [business.city, business.address]
    .filter(Boolean)
    .join(" · ");

  const fixture: StorefrontFixture = {
    slug: business.slug,
    name: business.name,
    location,
    sections: menu.map((category) => ({
      id: category.id,
      label: category.name,
      items: category.products.map((product) => ({
        productId: product.id,
        name: product.name,
        description: product.description ?? "",
        price: Number(product.price),
        image: product.image
          ? { src: product.image, alt: product.name }
          : undefined,
      })),
    })),
  };

  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen relative flex flex-col border-x border-outline/50 shadow-2xl shadow-black/5">
      <StorefrontMenu business={fixture} locale={locale} />
    </main>
  );
}
