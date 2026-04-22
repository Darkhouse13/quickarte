"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { Stripe, StripeElementsOptions } from "@stripe/stripe-js";
import { cn } from "@/lib/utils/cn";
import { formatAmount } from "@/lib/utils/currency";

type Props = {
  clientSecret: string;
  publishableKey: string;
  orderId: string;
  orderNumber: string;
  locale: string;
  businessSlug: string;
  totalAmount: number;
  onBack: () => void;
};

// Cache the Stripe.js loader outside the component so it only runs once.
const stripeCache: Record<string, Promise<Stripe | null>> = {};
function getStripe(key: string): Promise<Stripe | null> {
  if (!stripeCache[key]) stripeCache[key] = loadStripe(key);
  return stripeCache[key];
}

// Brutalist overrides for Stripe Elements. Matches our token palette.
// `theme: 'none'` gives us a blank canvas; variables + rules do the rest.
// Stripe accepts 'stripe' | 'flat' | 'night'. 'flat' is the most pared-down
// baseline (no shadows, minimal chrome); brutalist overrides follow below.
// The spec called for theme: 'none' which isn't in the schema.
const appearance: StripeElementsOptions["appearance"] = {
  theme: "flat",
  variables: {
    colorPrimary: "#C4653A",
    colorBackground: "#FAFAFA",
    colorText: "#0A0A0A",
    colorDanger: "#C4653A",
    borderRadius: "0px",
    fontFamily: "Space Mono, ui-monospace, monospace",
    fontSizeBase: "14px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "2px solid #0A0A0A",
      borderRadius: "0px",
      backgroundColor: "#FAFAFA",
      padding: "12px",
      boxShadow: "none",
    },
    ".Input:focus": {
      outline: "none",
      boxShadow: "0 0 0 4px rgba(196, 101, 58, 0.2)",
    },
    ".Label": {
      fontFamily: "Space Mono, ui-monospace, monospace",
      fontSize: "11px",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "rgba(10, 10, 10, 0.6)",
      marginBottom: "6px",
    },
    ".Tab": {
      border: "2px solid rgba(10, 10, 10, 0.15)",
      borderRadius: "0px",
      backgroundColor: "#FAFAFA",
      padding: "10px 12px",
      boxShadow: "none",
    },
    ".Tab--selected": {
      border: "2px solid #0A0A0A",
      backgroundColor: "#FAFAFA",
    },
    ".Tab:hover": {
      border: "2px solid rgba(10, 10, 10, 0.6)",
      color: "#0A0A0A",
    },
    ".Block": {
      borderRadius: "0px",
      border: "2px solid rgba(10, 10, 10, 0.15)",
      backgroundColor: "#FAFAFA",
    },
    ".Error": {
      color: "#C4653A",
      fontFamily: "Space Mono, ui-monospace, monospace",
      fontSize: "12px",
      textTransform: "uppercase",
      letterSpacing: "0.15em",
    },
  },
};

export function StripePaymentStep(props: Props) {
  const stripePromise = useMemo(
    () => getStripe(props.publishableKey),
    [props.publishableKey],
  );

  const options: StripeElementsOptions = {
    clientSecret: props.clientSecret,
    appearance,
    locale: "fr",
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm {...props} />
    </Elements>
  );
}

function PaymentForm({
  orderId,
  orderNumber,
  locale,
  businessSlug,
  totalAmount,
  onBack,
}: Props) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setError(null);
    setSubmitting(true);

    const returnUrl = `${window.location.origin}/${locale}/${businessSlug}/order/confirmation?orderId=${orderId}`;

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(
        confirmError.message ??
          "Le paiement a échoué. Merci de réessayer.",
      );
      setSubmitting(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      router.replace(
        `/${locale}/${businessSlug}/order/confirmation?orderId=${orderId}&pi=${paymentIntent.id}`,
      );
      return;
    }

    // Any other status (processing, requires_action, etc.) → let Stripe's
    // return_url redirect handle it. If we land here, the browser is mid-nav.
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-screen">
      <header className="pt-8 px-6 pb-6 border-b-2 border-ink bg-base sticky top-0 z-20">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="font-mono text-[11px] uppercase tracking-widest text-ink/60 hover:text-ink disabled:opacity-50 flex items-center gap-2 mb-3"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="square"
            strokeLinejoin="miter"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Retour à la commande
        </button>
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Paiement
        </h1>
        <p className="font-mono text-xs text-ink/60 mt-2 uppercase tracking-widest">
          Commande n° {orderNumber}
        </p>
      </header>

      <section className="px-6 py-6 border-b-4 border-outline">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
            Montant à régler
          </span>
          <span className="font-mono font-bold text-2xl tracking-tight">
            {formatAmount(totalAmount)}{" "}
            <span className="text-sm font-sans font-normal text-ink/60">€</span>
          </span>
        </div>
      </section>

      <section className="px-6 py-6 pb-32 flex-1">
        <PaymentElement
          options={{
            layout: { type: "accordion", defaultCollapsed: false },
          }}
        />
      </section>

      {error ? (
        <div className="fixed bottom-[96px] left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="w-full max-w-[480px] bg-ink text-base border-2 border-ink px-4 py-3 pointer-events-auto">
            <p className="font-mono text-[11px] uppercase tracking-widest font-bold mb-1">
              Échec du paiement
            </p>
            <p className="font-sans text-[13px] leading-snug">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-0 left-0 w-full z-50 flex justify-center pointer-events-none">
        <div className="w-full max-w-[480px] bg-base border-t-2 border-ink p-4 pointer-events-auto shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <button
            type="submit"
            disabled={submitting || !stripe || !elements}
            className={cn(
              "w-full px-6 py-4 flex justify-between items-center border-2 border-transparent transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20",
              submitting
                ? "bg-ink text-base cursor-wait"
                : "bg-accent text-base hover:bg-ink hover:border-base",
            )}
          >
            <span className="font-bold uppercase tracking-widest text-sm">
              {submitting ? "Traitement…" : "Payer maintenant"}
            </span>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-lg">
                {formatAmount(totalAmount)}{" "}
                <span className="text-sm font-sans font-normal">€</span>
              </span>
              {submitting ? (
                <span
                  className="w-5 h-5 border-2 border-base border-t-transparent animate-spin inline-block"
                  aria-hidden="true"
                />
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
            </div>
          </button>
        </div>
      </div>
    </form>
  );
}
