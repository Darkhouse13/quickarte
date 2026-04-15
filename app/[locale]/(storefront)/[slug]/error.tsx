"use client";

export default function StorefrontError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen flex flex-col items-center justify-center gap-6 border-x border-outline/50 px-6">
      <div className="w-10 h-10 border-2 border-ink flex items-center justify-center">
        <span className="font-mono font-bold text-accent text-lg leading-none">
          !
        </span>
      </div>
      <div className="flex flex-col gap-2 text-center max-w-[320px]">
        <p className="font-sans text-[16px] text-ink font-bold">
          Menu temporairement indisponible
        </p>
        <p className="font-sans text-sm text-ink/60 leading-snug">
          Le menu ne peut pas être chargé pour le moment. Merci de réessayer
          dans un instant.
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="bg-ink text-base px-6 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20"
      >
        Réessayer
      </button>
    </main>
  );
}
