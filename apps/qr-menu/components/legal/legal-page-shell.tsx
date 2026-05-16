import Link from "next/link";
import { hasIncompleteIdentifiers } from "@/lib/legal/identifiers";

type Props = {
  locale: string;
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
};

export function LegalPageShell({ locale, title, lastUpdated, children }: Props) {
  const draft = hasIncompleteIdentifiers();

  return (
    <main className="bg-base text-ink antialiased min-h-screen">
      <div className="w-full max-w-[640px] mx-auto px-6 md:px-8 pt-16 md:pt-24 pb-24">
        <Link
          href={`/${locale}`}
          className="font-mono text-xs uppercase tracking-widest text-ink/50 hover:text-ink transition"
        >
          ← Retour
        </Link>

        {draft ? (
          <aside className="mt-8 border border-outline px-5 py-4">
            <p className="font-sans text-sm text-ink/70 leading-relaxed">
              Cette page est en cours de finalisation. Les mentions légales
              définitives seront publiées prochainement.
            </p>
          </aside>
        ) : null}

        <h1 className="mt-8 font-sans font-black text-4xl md:text-5xl tracking-tight leading-[1.05]">
          {title}
        </h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-widest text-ink/40">
          Dernière mise à jour — {lastUpdated}
        </p>

        <div className="mt-12 space-y-10">{children}</div>
      </div>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-outline pt-8 first:border-t-0 first:pt-0">
      <h2 className="font-mono font-bold uppercase tracking-widest text-sm text-ink">
        {title}
      </h2>
      <div className="mt-5 font-sans text-[15px] text-ink/70 leading-[1.7] space-y-3">
        {children}
      </div>
    </section>
  );
}
