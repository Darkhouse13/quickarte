import { env } from "@/lib/env";
import type { ModuleKey } from "@/lib/entitlements/types";

const COPY: Record<ModuleKey, { title: string; benefit: string }> = {
  menu_qr: {
    title: "Menu numérique & QR code",
    benefit: "Affichez votre menu en ligne, accessible via QR.",
  },
  online_ordering: {
    title: "Commande en ligne",
    benefit: "Laissez vos clients commander depuis leur table.",
  },
  loyalty: {
    title: "Programme de fidélité",
    benefit: "Récompensez vos clients réguliers.",
  },
  analytics: {
    title: "Analyses de vente",
    benefit:
      "Comprenez ce qui se vend, et qui sont vos meilleurs clients.",
  },
};

type UpsellCardProps = {
  module: ModuleKey;
  className?: string;
};

function buildContactHref(rawContact: string | undefined): {
  href: string;
  label: string;
} {
  const fallback = { href: "mailto:hello@quickarte.fr", label: "Parler à Quickarte" };
  if (!rawContact) return fallback;
  const value = rawContact.trim();
  if (!value) return fallback;
  if (
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("https://") ||
    value.startsWith("http://")
  ) {
    return { href: value, label: "Parler à Quickarte" };
  }
  if (value.includes("@")) {
    return { href: `mailto:${value}`, label: "Parler à Quickarte" };
  }
  return { href: value, label: "Parler à Quickarte" };
}

export function UpsellCard({ module, className }: UpsellCardProps) {
  const copy = COPY[module];
  const { href, label } = buildContactHref(env.NEXT_PUBLIC_SALES_CONTACT);

  return (
    <section
      className={[
        "px-6 py-12 flex flex-col items-stretch gap-6",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="border-2 border-ink p-6 flex flex-col gap-5 bg-base">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50 font-bold">
            Module non activé
          </span>
          <div className="w-6 h-6 border-2 border-ink flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-ink" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-mono font-bold text-lg uppercase tracking-tight leading-tight">
            {copy.title}
          </h2>
          <p className="font-sans text-sm text-ink/70 leading-snug">
            {copy.benefit}
          </p>
        </div>
        <a
          href={href}
          className="self-start bg-ink text-base px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20"
        >
          {label} →
        </a>
      </div>
    </section>
  );
}
