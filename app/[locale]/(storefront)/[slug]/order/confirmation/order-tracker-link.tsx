import React from "react";
import Link from "next/link";

export function OrderTrackerLink({
  locale,
  customerAccessToken,
}: {
  locale: string;
  customerAccessToken: string | null | undefined;
}) {
  if (!customerAccessToken) return null;

  return (
    <Link
      href={`/${locale}/o/${customerAccessToken}`}
      className="w-full bg-ink text-base px-6 py-4 flex justify-between items-center hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-ink/20"
    >
      <span className="font-bold uppercase tracking-widest text-sm">
        SUIVRE MA COMMANDE →
      </span>
    </Link>
  );
}
