import Link from "next/link";

export default function MerchantNotFound() {
  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen flex flex-col items-center justify-center gap-6 border-x border-outline/50 px-6">
      <span className="font-mono font-bold text-4xl tracking-tighter text-ink">
        404
      </span>
      <div className="flex flex-col gap-2 text-center max-w-[320px]">
        <p className="font-sans text-[16px] text-ink font-bold">
          Page introuvable
        </p>
        <p className="font-sans text-sm text-ink/60 leading-snug">
          {"Le lien demand\u00e9 n'existe pas ou a \u00e9t\u00e9 d\u00e9plac\u00e9."}
        </p>
      </div>
      <div className="grid grid-cols-2 border-2 border-ink">
        <Link
          href="/catalog"
          className="px-5 py-3 border-r-2 border-ink font-mono font-bold uppercase tracking-widest text-[12px] text-ink hover:bg-black/[0.03] transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/40"
        >
          Retour
        </Link>
        <Link
          href="/home"
          className="px-5 py-3 bg-ink text-base font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/40"
        >
          Accueil
        </Link>
      </div>
    </main>
  );
}
