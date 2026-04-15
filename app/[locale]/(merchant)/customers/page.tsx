import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "Quickarte — Clients" };

type Props = { params: Promise<{ locale: string }> };

export default async function CustomersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Clients
        </h1>
      </header>
      <div className="flex-1 px-6 py-20 flex flex-col items-center text-center gap-6">
        <div className="w-12 h-12 border-2 border-ink flex items-center justify-center">
          <div className="w-3 h-3 border-2 border-ink" />
        </div>
        <div className="flex flex-col gap-2 max-w-[320px]">
          <p className="font-sans text-[15px] text-ink font-bold">
            Aucun client pour le moment
          </p>
          <p className="font-sans text-sm text-ink/60 leading-snug">
            Vos clients apparaîtront ici une fois les premières commandes
            reçues.
          </p>
        </div>
      </div>
    </>
  );
}
