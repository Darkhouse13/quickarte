import Link from "next/link";

export default function NotFound() {
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
          Le lien demandé n&apos;existe pas ou a été déplacé.
        </p>
      </div>
      <Link
        href="/"
        className="bg-ink text-base px-6 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
