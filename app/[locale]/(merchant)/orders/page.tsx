import { setRequestLocale } from "next-intl/server";
import { SectionHeader } from "@/components/ui/section-header";

type Props = { params: Promise<{ locale: string }> };

export default async function OrdersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Commandes
        </h1>
      </header>
      <div className="flex-1">
        <SectionHeader index={1} title="À venir" />
        <p className="p-6 text-sm text-ink/60">
          Gestion des commandes — à implémenter.
        </p>
      </div>
    </>
  );
}
