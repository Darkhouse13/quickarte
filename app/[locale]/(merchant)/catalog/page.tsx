import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { SectionHeader } from "@/components/ui/section-header";

type Props = { params: Promise<{ locale: string }> };

export default async function CatalogIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Catalogue
        </h1>
      </header>
      <div className="flex-1">
        <SectionHeader index={1} title="Articles" />
        <div className="p-6">
          <Link
            href="/catalog/new"
            className="inline-block bg-ink text-base px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest hover:bg-accent transition-colors"
          >
            + Nouvel article
          </Link>
        </div>
      </div>
    </>
  );
}
