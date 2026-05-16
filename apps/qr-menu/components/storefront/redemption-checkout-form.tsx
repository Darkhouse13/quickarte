"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import {
  creditCartItemCount,
  creditCartTotal,
  useCreditCartStore,
} from "@/lib/ordering/credit-cart-store";
import {
  getCustomerCreditBalance,
  placeRedemptionOrder,
} from "@/lib/loyalty/actions";
import { loyaltyErrorMessage } from "@/lib/loyalty/error-messages";
import { cn } from "@/lib/utils/cn";

type ActiveListing = {
  listingId: string;
  productId: string;
  productName: string;
  creditPrice: number;
};

type Props = {
  locale: string;
  businessSlug: string;
  creditLabel: string;
  dineInEnabled: boolean;
  takeawayEnabled: boolean;
  // Used to detect when the cart references a listing that has since been
  // deactivated server-side — auto-remove on PRODUCT_NOT_REDEEMABLE.
  activeListings: ActiveListing[];
};

type OrderType = "dine_in" | "takeaway";

export function RedemptionCheckoutForm({
  locale,
  businessSlug,
  creditLabel,
  dineInEnabled,
  takeawayEnabled,
  activeListings,
}: Props) {
  const router = useRouter();
  const items = useCreditCartStore((s) => s.items);
  const phoneNormalized = useCreditCartStore((s) => s.phoneNormalized);
  const storeSlug = useCreditCartStore((s) => s.businessSlug);
  const removeItem = useCreditCartStore((s) => s.removeItem);
  const clearCart = useCreditCartStore((s) => s.clearCart);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const cartItems = hydrated ? items : [];
  const cartTotal = useMemo(() => creditCartTotal(cartItems), [cartItems]);
  const cartCount = useMemo(() => creditCartItemCount(cartItems), [cartItems]);

  const defaultType: OrderType = dineInEnabled ? "dine_in" : "takeaway";
  const [orderType, setOrderType] = useState<OrderType>(defaultType);
  const [tableNumber, setTableNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [showRecharge, setShowRecharge] = useState(false);
  const [serverBalance, setServerBalance] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  // Successful submit clears the cart then redirects to the tracker — the
  // cleared cart would otherwise re-trigger the bounce-back below and race
  // the redirect. The flag holds the page steady until the route changes.
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // If the user arrived here directly (no cart), or for a different slug,
    // bounce back to the rewards menu — there is nothing to confirm.
    if (!hydrated || submitted) return;
    if (cartCount === 0 || (storeSlug && storeSlug !== businessSlug)) {
      router.replace(`/${locale}/${businessSlug}/recompenses`);
    }
  }, [hydrated, cartCount, storeSlug, businessSlug, locale, router, submitted]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setShowRecharge(false);
    if (!phoneNormalized) {
      router.replace(`/${locale}/${businessSlug}/recompenses`);
      return;
    }
    const payload = {
      businessSlug,
      phoneRaw: phoneNormalized,
      items: cartItems.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
      })),
      notes: notes.trim() || undefined,
      type: orderType,
      tableNumber:
        orderType === "dine_in" && tableNumber.trim().length > 0
          ? tableNumber.trim()
          : undefined,
    };
    startTransition(async () => {
      try {
        const response = await placeRedemptionOrder(payload);
        if (response.status === "success") {
          setSubmitted(true);
          router.replace(response.data.customerUrl);
          clearCart();
          return;
        }
        // Map typed errors to the right inline behaviour.
        if (response.code === "PRODUCT_NOT_REDEEMABLE") {
          // Auto-remove any cart line whose listing is no longer active.
          const activeIds = new Set(activeListings.map((l) => l.productId));
          const stale = cartItems.filter(
            (line) => !activeIds.has(line.productId),
          );
          for (const line of stale) removeItem(line.listingId);
        }
        if (response.code === "INSUFFICIENT_CREDITS") {
          setShowRecharge(true);
        }
        setErrorCode(response.code);
        setError(loyaltyErrorMessage(response.code, response.message));
      } catch {
        setErrorCode("NETWORK_ERROR");
        setError(loyaltyErrorMessage("NETWORK_ERROR"));
      }
    });
  };

  const handleRecharge = async () => {
    if (!phoneNormalized) return;
    try {
      const response = await getCustomerCreditBalance({
        businessSlug,
        phoneRaw: phoneNormalized,
      });
      if (response.status === "success") {
        setServerBalance(response.data.balance);
      }
    } catch {
      // Quietly keep the existing error; the user can retry submission.
    }
  };

  if (!hydrated) {
    return <section className="px-6 py-12" />;
  }

  return (
    <form onSubmit={submit} className="flex flex-col">
      <section className="px-6 py-8 border-b border-outline">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold mb-4">
          Articles
        </p>
        <ul className="flex flex-col">
          {cartItems.map((line, index) => (
            <li
              key={line.listingId}
              className={cn(
                "py-3 flex justify-between gap-4",
                index < cartItems.length - 1
                  ? "border-b border-outline"
                  : null,
              )}
            >
              <div className="min-w-0">
                <p className="font-sans text-[15px] font-bold leading-tight">
                  {line.productName}{" "}
                  <span className="font-mono text-ink/50">
                    ×{line.quantity}
                  </span>
                </p>
              </div>
              <span className="font-mono text-[14px] font-bold tabular-nums whitespace-nowrap">
                {line.creditPrice * line.quantity} {creditLabel}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 pt-4 border-t-2 border-ink flex justify-between items-baseline">
          <span className="font-mono text-[12px] uppercase tracking-widest font-bold">
            Total
          </span>
          <span className="font-mono font-bold text-2xl tabular-nums">
            {cartTotal} {creditLabel}
          </span>
        </div>
      </section>

      <section className="px-6 py-8 border-b border-outline flex flex-col gap-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold">
          Type
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!dineInEnabled}
            onClick={() => setOrderType("dine_in")}
            className={cn(
              "min-h-[56px] border-2 px-4 py-3 font-mono text-[12px] uppercase tracking-widest font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:border-outline disabled:text-ink/40 disabled:cursor-not-allowed",
              orderType === "dine_in"
                ? "bg-ink text-base border-ink"
                : "border-ink hover:bg-ink hover:text-base",
            )}
          >
            Sur place
          </button>
          <button
            type="button"
            disabled={!takeawayEnabled}
            onClick={() => setOrderType("takeaway")}
            className={cn(
              "min-h-[56px] border-2 px-4 py-3 font-mono text-[12px] uppercase tracking-widest font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:border-outline disabled:text-ink/40 disabled:cursor-not-allowed",
              orderType === "takeaway"
                ? "bg-ink text-base border-ink"
                : "border-ink hover:bg-ink hover:text-base",
            )}
          >
            À emporter
          </button>
        </div>
        {orderType === "dine_in" ? (
          <FormInput
            label="Numéro de table"
            name="table_number"
            type="text"
            inputMode="numeric"
            placeholder="12"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
          />
        ) : null}
        <FormTextarea
          label="Note (optionnel)"
          name="notes"
          rows={3}
          maxLength={200}
          placeholder="Sans sucre, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </section>

      <section className="px-6 py-8 flex flex-col gap-4">
        <button
          type="submit"
          disabled={isPending || cartCount === 0}
          className="w-full min-h-[56px] bg-accent text-base px-5 py-4 flex items-center justify-between gap-3 hover:bg-ink transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:bg-outline disabled:text-ink/40 disabled:cursor-not-allowed"
        >
          <span className="font-mono text-[13px] uppercase tracking-widest font-bold">
            {isPending
              ? "Confirmation…"
              : `Confirmer l'échange — ${cartTotal} ${creditLabel}`}
          </span>
          {isPending ? null : (
            <svg
              width="20"
              height="20"
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
        </button>

        {error ? (
          <div className="border-2 border-accent px-4 py-4 flex flex-col gap-3">
            <p className="font-sans text-[14px] text-ink leading-snug">
              {error}
            </p>
            {errorCode === "INSUFFICIENT_CREDITS" && showRecharge ? (
              <button
                type="button"
                onClick={handleRecharge}
                className="self-start min-h-[44px] border-2 border-ink px-4 py-2 hover:bg-ink hover:text-base transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
              >
                <span className="font-mono text-[12px] uppercase tracking-widest font-bold">
                  Recharger
                </span>
              </button>
            ) : null}
            {serverBalance !== null ? (
              <p className="font-mono text-[11px] uppercase tracking-widest text-ink/60">
                Solde actuel : {serverBalance} {creditLabel}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </form>
  );
}
