"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils/cn";
import { updateProductAvailability } from "@/lib/catalog/actions";

type Props = {
  productId: string;
  initial: boolean;
};

export function ProductAvailabilityToggle({ productId, initial }: Props) {
  const [checked, setChecked] = useState(initial);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !checked;
    setChecked(next);
    startTransition(async () => {
      try {
        await updateProductAvailability(productId, next);
      } catch {
        setChecked(!next);
      }
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={toggle}
      disabled={pending}
      aria-label="Disponibilité"
      className={cn(
        "w-10 h-5 border-2 border-ink p-[2px] flex items-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all disabled:opacity-60",
        checked ? "bg-ink justify-end" : "bg-base justify-start",
      )}
    >
      <div className="w-3 h-3 bg-base border border-ink" />
    </button>
  );
}
