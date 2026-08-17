import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

// The public domain is the entry point for the active customer storefront.
// Keep the default-locale URL canonical while preserving an explicit Arabic URL.
export default async function RootPage({ params }: Props) {
  const { locale } = await params;
  redirect(locale === "ar" ? "/ar/la-bocateria" : "/la-bocateria");
}
