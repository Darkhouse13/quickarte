import Link from "next/link";

type Section = {
  num: string;
  title: string;
  body: React.ReactNode;
};

type Props = {
  title: string;
  intro?: React.ReactNode;
  sections: Section[];
};

export function LegalShell({ title, intro, sections }: Props) {
  return (
    <main className="bg-base text-ink antialiased min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-base border-b border-outline">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-5 flex items-center justify-between">
          <Link
            href="/"
            className="font-mono font-bold tracking-widest text-sm text-ink"
          >
            QUICKARTE
          </Link>
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-widest text-ink/60 hover:text-ink transition"
          >
            ACCUEIL →
          </Link>
        </div>
      </header>

      <article className="flex-1 w-full max-w-[720px] mx-auto px-6 md:px-8 py-16 md:py-24">
        <h1 className="font-mono font-bold uppercase tracking-widest text-ink text-2xl md:text-3xl leading-tight">
          {title}
        </h1>

        {intro ? (
          <div className="mt-8 font-sans text-base text-ink/70 leading-[1.75] space-y-4">
            {intro}
          </div>
        ) : null}

        <div className="mt-12 space-y-12">
          {sections.map((s, i) => (
            <section
              key={s.num}
              className={i < sections.length - 1 ? "border-b border-outline pb-12" : ""}
            >
              <h2 className="font-mono font-bold uppercase tracking-widest text-ink text-sm md:text-base leading-snug">
                <span className="text-ink/40">{s.num} /</span> {s.title}
              </h2>
              <div className="mt-6 font-sans text-base text-ink/70 leading-[1.75] space-y-4">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </article>

      <footer className="border-t-2 border-ink">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div
            className="font-mono uppercase tracking-widest text-ink/40"
            style={{ fontSize: "11px" }}
          >
            © 2026 QUICKARTE
          </div>
          <div
            className="font-mono uppercase tracking-widest text-ink/50 flex flex-wrap items-center gap-x-2 gap-y-1"
            style={{ fontSize: "11px" }}
          >
            <Link href="/mentions-legales" className="hover:text-ink transition">
              Mentions légales
            </Link>
            <span className="text-ink/30">·</span>
            <Link href="/confidentialite" className="hover:text-ink transition">
              Confidentialité
            </Link>
            <span className="text-ink/30">·</span>
            <Link href="/cgv" className="hover:text-ink transition">
              CGV
            </Link>
            <span className="text-ink/30">·</span>
            <a
              href="mailto:bonjour@quickarte.fr"
              className="hover:text-ink transition normal-case"
            >
              bonjour@quickarte.fr
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
