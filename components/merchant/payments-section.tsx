import { SectionHeader } from "@/components/ui/section-header";
import type { StripeConnectStatus } from "@/lib/payments";
import {
  openStripeDashboard,
  refreshStripeStatus,
  resumeStripeOnboarding,
  startStripeConnect,
} from "@/app/[locale]/(merchant)/settings/actions";
import { ConnectBusinessTypePicker } from "./connect-business-type-picker";

type Props = {
  status: StripeConnectStatus;
  stripeQueryFlag?: string;
};

export function PaymentsSection({ status, stripeQueryFlag }: Props) {
  return (
    <section className="border-t-4 border-outline">
      <SectionHeader index={2} title="Paiements" />
      <div className="px-6 py-6">
        {stripeQueryFlag === "connected" ? (
          <JustReturnedBanner />
        ) : null}

        {status.state === "not_connected" ? <NotConnectedCard /> : null}
        {status.state === "onboarding_incomplete" ? (
          <OnboardingIncompleteCard />
        ) : null}
        {status.state === "connected" ? <ConnectedCard /> : null}
      </div>
    </section>
  );
}

function JustReturnedBanner() {
  return (
    <div className="mb-5 border-2 border-ink bg-accent/10 px-4 py-3">
      <p className="font-mono text-[11px] uppercase tracking-widest text-ink font-bold">
        Retour de Stripe →
      </p>
      <p className="font-sans text-[13px] text-ink/70 mt-1 leading-snug">
        Si le statut ci-dessous n&apos;est pas à jour, cliquez sur
        &nbsp;«&nbsp;Vérifier le statut&nbsp;».
      </p>
    </div>
  );
}

function NotConnectedCard() {
  return (
    <div className="border-2 border-ink p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50 font-bold">
          Non connecté
        </span>
        <p className="font-sans text-[15px] font-bold leading-tight">
          Activez les paiements en ligne
        </p>
        <p className="font-sans text-sm text-ink/60 leading-snug">
          Connectez votre compte Stripe pour recevoir les commandes payées par
          carte, Apple&nbsp;Pay ou Google&nbsp;Pay. Paiements déposés
          directement sur votre compte bancaire.
        </p>
      </div>
      <form action={startStripeConnect} className="flex flex-col gap-4">
        <ConnectBusinessTypePicker />
        <button
          type="submit"
          className="self-start bg-ink text-base px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20"
        >
          Connecter Stripe →
        </button>
      </form>
    </div>
  );
}

function OnboardingIncompleteCard() {
  return (
    <div className="border-2 border-ink p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-accent font-bold">
          Onboarding en cours
        </span>
        <p className="font-sans text-[15px] font-bold leading-tight">
          Finalisez votre compte Stripe
        </p>
        <p className="font-sans text-sm text-ink/60 leading-snug">
          Quelques informations manquent encore (identité, compte bancaire).
          Reprenez là où vous en étiez pour activer les paiements.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <form action={resumeStripeOnboarding}>
          <button
            type="submit"
            className="w-full sm:w-auto bg-ink text-base px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20"
          >
            Reprendre l&apos;onboarding →
          </button>
        </form>
        <form action={refreshStripeStatus}>
          <button
            type="submit"
            className="w-full sm:w-auto bg-base text-ink px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-ink hover:text-base transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20"
          >
            Vérifier le statut →
          </button>
        </form>
      </div>
    </div>
  );
}

function ConnectedCard() {
  return (
    <div className="border-2 border-ink p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-accent font-bold">
          ✓ Activé
        </span>
        <p className="font-sans text-[15px] font-bold leading-tight">
          Paiements activés
        </p>
        <p className="font-sans text-sm text-ink/60 leading-snug">
          100&nbsp;% de vos revenus vous reviennent. Quickarte ne prélève
          aucune commission sur les commandes.
        </p>
      </div>
      <form action={openStripeDashboard}>
        <button
          type="submit"
          className="self-start bg-base text-ink px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-ink hover:text-base transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20"
        >
          Voir mon tableau de bord Stripe →
        </button>
      </form>
    </div>
  );
}
