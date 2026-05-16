import Link from "next/link";

const LINKS = [
  { href: "mentions-legales", label: "Mentions légales" },
  { href: "politique-de-confidentialite", label: "Politique de confidentialité" },
  { href: "cgu", label: "CGU" },
  { href: "contact", label: "Contact" },
] as const;

// Thin, quiet compliance band for public surfaces (landing, public menu,
// customer order tracker). Not rendered on authed merchant routes.
export function ComplianceFooter({ locale }: { locale: string }) {
  return (
    <footer className="border-t border-outline px-6 py-5">
      <ul className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono uppercase tracking-widest text-ink/40 text-[11px]">
        {LINKS.map((link, i) => (
          <li key={link.href} className="flex items-center gap-x-2">
            {i > 0 ? <span className="text-ink/20">·</span> : null}
            <Link
              href={`/${locale}/${link.href}`}
              className="hover:text-ink transition"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </footer>
  );
}
