import Link from "next/link";
import { setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

const links = [
  { href: "/cafe-des-arts", label: "Storefront — Café des Arts" },
  { href: "/home", label: "Merchant Dashboard" },
  { href: "/catalog/new", label: "Add Item Form" },
];

export default async function IndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen flex flex-col border-x border-outline/50 shadow-2xl shadow-black/5">
      <header className="pt-12 px-6 pb-8 border-b-2 border-ink">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Quickarte
        </h1>
        <p className="font-mono text-xs text-ink/60 mt-3 uppercase tracking-widest">
          Commerce OS — Scaffold Preview
        </p>
      </header>
      <nav className="flex flex-col">
        {links.map((l, i) => (
          <Link
            key={l.href}
            href={l.href}
            className={`p-6 ${
              i !== links.length - 1 ? "border-b border-outline" : ""
            } flex items-center justify-between hover:bg-black/[0.02] transition-colors group relative`}
          >
            <div className="absolute left-0 top-0 w-1 h-full bg-accent scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
            <span className="font-bold text-[16px] tracking-tight">
              {l.label}
            </span>
            <span className="font-mono text-ink/30 group-hover:text-ink transition-colors text-lg">
              →
            </span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
