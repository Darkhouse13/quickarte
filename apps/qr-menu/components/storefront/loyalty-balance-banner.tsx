"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getCustomerCreditBalance,
} from "@/lib/loyalty/actions";
import {
  readPhoneFromLocalStorage,
  resolveCustomerPhone,
} from "@/lib/ordering/credit-cart-store";

type Props = {
  locale: string;
  businessSlug: string;
  businessName: string;
  // Server tells us whether the program is active for this business. We
  // never render the banner for businesses that don't have credits — no
  // visual noise for first-time customers.
  loyaltyActive: boolean;
  creditLabel: string;
};

export function LoyaltyBalanceBanner({
  locale,
  businessSlug,
  businessName,
  loyaltyActive,
  creditLabel,
}: Props) {
  const [phone, setPhone] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!loyaltyActive) return;
    const stored = readPhoneFromLocalStorage();
    const resolved = resolveCustomerPhone({
      fromUrl: null,
      fromStorage: stored,
    });
    if (!resolved) return;
    setPhone(resolved);
    let cancelled = false;
    (async () => {
      try {
        const response = await getCustomerCreditBalance({
          businessSlug,
          phoneRaw: resolved,
        });
        if (cancelled) return;
        if (response.status === "success" && response.data.balance > 0) {
          setBalance(response.data.balance);
        }
      } catch {
        // Silent — the banner is purely additive; never block the menu on it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loyaltyActive, businessSlug]);

  if (!loyaltyActive || balance === null || balance === 0 || !phone) {
    return null;
  }

  return (
    <Link
      href={`/${locale}/${businessSlug}/recompenses?phone=${encodeURIComponent(
        phone,
      )}`}
      className="block w-full border-b border-ink bg-base px-6 py-3 hover:bg-accent/[0.06] transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
    >
      <p className="font-mono text-[11px] uppercase tracking-widest text-ink leading-snug flex items-center gap-2">
        <span className="font-bold tabular-nums">{balance}</span>{" "}
        {creditLabel} chez {businessName}
        <span className="ml-auto text-accent font-bold">→</span>
      </p>
    </Link>
  );
}
