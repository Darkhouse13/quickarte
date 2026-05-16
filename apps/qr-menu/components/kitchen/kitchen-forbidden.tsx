export function KitchenForbidden() {
  return (
    <div
      role="alert"
      className="flex-1 flex items-center justify-center px-6 py-16"
    >
      <div className="max-w-[420px] w-full border-2 border-ink p-8 flex flex-col gap-5 bg-base">
        <span className="font-mono font-bold text-[11px] uppercase tracking-widest text-accent">
          403 / Accès refusé
        </span>
        <h1 className="font-mono font-bold text-3xl uppercase tracking-tighter leading-none">
          Espace cuisine réservé
        </h1>
        <p className="font-sans text-[15px] text-ink/70 leading-snug">
          Cette page est accessible aux rôles cuisine, gérant et propriétaire.
          Demandez à votre responsable de vous donner les bons accès.
        </p>
      </div>
    </div>
  );
}
