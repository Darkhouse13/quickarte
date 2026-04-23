import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/auth/get-business";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Quickarte — L'OS commerçant",
  description: "L'OS commerçant, simple et puissant.",
};

export default async function LandingPage() {
  const current = await getCurrentBusiness();
  if (current) redirect(current.business ? "/home" : "/onboarding");

  return (
    <main className="min-h-screen bg-base text-ink flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[520px] flex flex-col items-start gap-12">
          <header className="flex flex-col gap-6">
            <p className="font-mono text-[11px] uppercase tracking-widest text-ink/40">
              01 / Quickarte
            </p>
            <h1 className="font-sans text-5xl md:text-6xl font-black tracking-tight leading-none">
              QUICKARTE
            </h1>
            <p className="font-sans text-lg md:text-xl text-ink/60 leading-snug max-w-[420px]">
              L&apos;OS commerçant, simple et puissant.
            </p>
          </header>

          <div className="w-full border-t-4 border-ink" />

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-0 border border-ink">
            <Link
              href="/register"
              className="group relative bg-accent text-base px-6 py-5 font-mono text-[12px] uppercase tracking-widest font-bold border-r border-ink focus:outline-none focus:ring-4 focus:ring-accent/20 transition-colors hover:bg-ink hover:text-base"
            >
              Créer mon établissement
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
            <Link
              href="/login"
              className="group bg-ink text-base px-6 py-5 font-mono text-[12px] uppercase tracking-widest font-bold focus:outline-none focus:ring-4 focus:ring-accent/20 transition-colors hover:bg-accent"
            >
              Se connecter
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
