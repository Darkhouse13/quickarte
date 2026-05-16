"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FormInput } from "@/components/ui/form-input";
import {
  canAddListing,
  creditCartItemCount,
  creditCartTotal,
  readPhoneFromLocalStorage,
  resolveCustomerPhone,
  useCreditCartStore,
  writePhoneToLocalStorage,
} from "@/lib/ordering/credit-cart-store";
import type { CustomerRedemptionListing } from "@/lib/loyalty/credits-queries";

type Props = {
  locale: string;
  businessSlug: string;
  businessName: string;
  creditLabel: string;
  listings: CustomerRedemptionListing[];
  // Server-resolved phone (validated). null when no phone was provided and
  // the page should render the identification gate.
  initialPhone: string | null;
  // Authoritative balance fetched server-side; null when no phone known.
  initialBalance: number | null;
};

export function RedemptionMenu({
  locale,
  businessSlug,
  businessName,
  creditLabel,
  listings,
  initialPhone,
  initialBalance,
}: Props) {
  const router = useRouter();

  const items = useCreditCartStore((s) => s.items);
  const storeSlug = useCreditCartStore((s) => s.businessSlug);
  const setIdentity = useCreditCartStore((s) => s.setIdentity);
  const addItem = useCreditCartStore((s) => s.addItem);
  const removeItem = useCreditCartStore((s) => s.removeItem);
  const decrementListing = useCreditCartStore((s) => s.decrementListing);

  const [hydrated, setHydrated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Pull localStorage phone into the URL when nothing else identified us.
    if (!initialPhone) {
      const stored = readPhoneFromLocalStorage();
      const resolved = resolveCustomerPhone({
        fromUrl: null,
        fromStorage: stored,
      });
      if (resolved && resolved !== initialPhone) {
        router.replace(
          `/${locale}/${businessSlug}/recompenses?phone=${encodeURIComponent(
            resolved,
          )}`,
        );
      }
      return;
    }
    // Make sure the cart store knows which slug + phone it is for; switching
    // slug clears the cart inside the store.
    if (storeSlug !== businessSlug) {
      setIdentity({ businessSlug, phoneNormalized: initialPhone });
    } else {
      setIdentity({ businessSlug, phoneNormalized: initialPhone });
    }
  }, [
    hydrated,
    initialPhone,
    storeSlug,
    businessSlug,
    setIdentity,
    locale,
    router,
  ]);

  const cartItems = hydrated ? items : [];
  const cartTotal = useMemo(() => creditCartTotal(cartItems), [cartItems]);
  const cartCount = useMemo(() => creditCartItemCount(cartItems), [cartItems]);
  const balance = initialBalance ?? 0;
  const remaining = Math.max(balance - cartTotal, 0);
  const overspending = cartTotal > balance;

  if (!initialPhone) {
    return (
      <>
        <header className="px-6 pt-12 pb-6 border-b border-outline">
          <h1 className="font-mono font-bold uppercase tracking-tighter leading-none text-2xl">
            {businessName}
          </h1>
        </header>
        <IdentificationGate
          locale={locale}
          businessSlug={businessSlug}
          creditLabel={creditLabel}
        />
      </>
    );
  }

  return (
    <>
      <header className="px-6 pt-12 pb-6 border-b border-outline">
        <h1 className="font-mono font-bold uppercase tracking-tighter leading-none text-2xl">
          {businessName}
        </h1>
      </header>

      <section className="px-6 py-8 border-b-4 border-outline flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold">
          Votre solde
        </p>
        <div className="flex items-baseline gap-3">
          <span className="font-mono font-bold tabular-nums leading-none tracking-tight text-[40px]">
            {balance}
          </span>
          <span className="font-mono text-[12px] uppercase tracking-widest text-ink/55 font-bold">
            {creditLabel}
          </span>
        </div>
      </section>

      {listings.length === 0 ? (
        <EmptyState locale={locale} businessSlug={businessSlug} />
      ) : (
        <ul className="flex flex-col">
          {listings.map((listing, index) => {
            const inCart = cartItems
              .filter((item) => item.listingId === listing.listingId)
              .reduce((sum, item) => sum + item.quantity, 0);
            const canAdd = canAddListing({
              listing,
              cart: cartItems,
              balance,
            });
            return (
              <ListingCard
                key={listing.listingId}
                listing={listing}
                creditLabel={creditLabel}
                inCart={inCart}
                canAdd={canAdd}
                onAdd={() =>
                  addItem({
                    listingId: listing.listingId,
                    productId: listing.productId,
                    productName: listing.productName,
                    creditPrice: listing.creditPrice,
                    image: listing.productImage ?? undefined,
                  })
                }
                onDecrease={() => decrementListing(listing.listingId)}
                isLast={index === listings.length - 1}
              />
            );
          })}
        </ul>
      )}

      <div className="pb-32" />

      {cartCount > 0 ? (
        <div className="fixed bottom-0 left-0 w-full z-50 flex justify-center pointer-events-none">
          <div className="w-full max-w-[480px] bg-base border-t-2 border-ink pointer-events-auto shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
            {expanded ? (
              <ul className="border-b border-outline">
                {cartItems.map((line) => (
                  <li
                    key={line.listingId}
                    className="px-6 py-4 flex justify-between items-center gap-4 border-b border-outline last:border-b-0"
                  >
                    <div className="min-w-0 flex flex-col gap-1">
                      <p className="font-sans text-[14px] font-bold leading-tight truncate">
                        {line.productName}
                      </p>
                      <p className="font-mono text-[11px] uppercase tracking-widest text-ink/55">
                        {line.creditPrice} {creditLabel} · ×{line.quantity}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(line.listingId)}
                      className="font-mono text-[11px] uppercase tracking-widest text-ink/55 hover:text-accent transition-colors focus:outline-none"
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="p-4 flex justify-between items-center gap-4">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex flex-col items-start min-w-0 focus:outline-none"
              >
                <span className="font-mono text-[11px] uppercase tracking-widest text-ink/55">
                  {cartCount} {cartCount === 1 ? "article" : "articles"} ·{" "}
                  <span className="font-bold tabular-nums">{cartTotal}</span>{" "}
                  {creditLabel}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-widest text-ink/40">
                  Solde restant{" "}
                  <span className="tabular-nums">{remaining}</span>
                </span>
              </button>
              <button
                type="button"
                disabled={overspending}
                onClick={() => {
                  if (!overspending) {
                    router.push(
                      `/${locale}/${businessSlug}/recompenses/commande`,
                    );
                  }
                }}
                className="bg-accent text-base px-5 py-4 flex items-center gap-3 hover:bg-ink transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:bg-outline disabled:text-ink/40 disabled:cursor-not-allowed"
              >
                <span className="font-mono text-[13px] uppercase tracking-widest font-bold">
                  Échanger {cartTotal} {creditLabel}
                </span>
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
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </>
  );
}

function ListingCard({
  listing,
  creditLabel,
  inCart,
  canAdd,
  onAdd,
  onDecrease,
  isLast,
}: {
  listing: CustomerRedemptionListing;
  creditLabel: string;
  inCart: number;
  canAdd: boolean;
  onAdd: () => void;
  onDecrease: () => void;
  isLast: boolean;
}) {
  const [showInsufficient, setShowInsufficient] = useState(false);
  return (
    <li
      className={
        isLast
          ? "px-6 py-6 flex gap-4"
          : "px-6 py-6 flex gap-4 border-b border-outline"
      }
    >
      {listing.productImage ? (
        <div className="w-[80px] h-[80px] border border-ink shrink-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={listing.productImage}
            alt={listing.productName}
            className="w-full h-full object-cover brutalist-img"
          />
        </div>
      ) : null}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <p className="font-sans text-[16px] font-bold leading-tight">
          {listing.productName}
        </p>
        {listing.productDescription ? (
          <p className="font-sans text-[14px] text-ink/60 leading-snug line-clamp-2">
            {listing.productDescription}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3 mt-1">
          <span className="font-mono text-[16px] font-bold tabular-nums">
            {listing.creditPrice}{" "}
            <span className="text-xs text-ink/50">{creditLabel}</span>
          </span>
          <div className="flex items-center gap-2">
            {inCart > 0 ? (
              <button
                type="button"
                onClick={onDecrease}
                className="w-10 h-10 border border-ink flex items-center justify-center font-mono font-bold hover:bg-ink hover:text-base transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
                aria-label="Retirer"
              >
                −
              </button>
            ) : null}
            {inCart > 0 ? (
              <span className="font-mono font-bold tabular-nums w-6 text-center">
                {inCart}
              </span>
            ) : null}
            <button
              type="button"
              disabled={!canAdd}
              onClick={() => {
                if (canAdd) {
                  onAdd();
                  setShowInsufficient(false);
                } else {
                  setShowInsufficient(true);
                }
              }}
              className="min-h-[40px] px-4 border border-ink bg-base font-mono text-[12px] uppercase tracking-widest font-bold hover:bg-ink hover:text-base transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:border-outline disabled:text-ink/40 disabled:hover:bg-base disabled:hover:text-ink/40 disabled:cursor-not-allowed"
            >
              + Ajouter
            </button>
          </div>
        </div>
        {showInsufficient && !canAdd ? (
          <p className="font-sans text-[12px] text-ink/55 leading-snug">
            Solde insuffisant pour ajouter cet article.
          </p>
        ) : null}
      </div>
    </li>
  );
}

function IdentificationGate({
  locale,
  businessSlug,
  creditLabel,
}: {
  locale: string;
  businessSlug: string;
  creditLabel: string;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  return (
    <section className="px-6 py-10 flex flex-col gap-5">
      <div className="border border-ink px-5 py-6 flex flex-col gap-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold">
          Identifiez-vous
        </p>
        <p className="font-sans text-[15px] text-ink leading-snug">
          Identifiez-vous pour voir votre solde et échanger vos {creditLabel}.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (phone.trim().length === 0) return;
            writePhoneToLocalStorage(phone.trim());
            router.push(
              `/${locale}/${businessSlug}/recompenses?phone=${encodeURIComponent(
                phone.trim(),
              )}`,
            );
          }}
          className="flex flex-col gap-4"
        >
          <FormInput
            label="Téléphone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="06 12 34 56 78"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            type="submit"
            className="w-full min-h-[56px] bg-ink text-base px-5 py-4 flex items-center justify-center hover:bg-accent transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
          >
            <span className="font-mono text-[13px] uppercase tracking-widest font-bold">
              Voir mon solde
            </span>
          </button>
        </form>
      </div>
    </section>
  );
}

function EmptyState({
  locale,
  businessSlug,
}: {
  locale: string;
  businessSlug: string;
}) {
  return (
    <section className="px-6 py-16 flex flex-col gap-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold">
        Récompenses
      </p>
      <p className="font-mono font-bold uppercase tracking-tight text-[20px] leading-tight">
        Aucune récompense disponible pour le moment.
      </p>
      <p className="font-sans text-[14px] text-ink/60 leading-snug max-w-[360px]">
        Revenez plus tard, le restaurant ajoute régulièrement de nouvelles
        récompenses.
      </p>
      <Link
        href={`/${locale}/${businessSlug}`}
        className="font-mono text-[11px] uppercase tracking-widest text-accent font-bold inline-flex items-center gap-2 hover:text-ink transition-colors"
      >
        ← Retour au menu
      </Link>
    </section>
  );
}
