"use client";

import { cn } from "@/lib/utils/cn";

type MenuItemCardProps = {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  image?: { src: string; alt: string };
  badge?: string;
  isLast?: boolean;
  onClick?: () => void;
  onAdd?: () => void;
  quantity?: number;
  className?: string;
};

export function MenuItemCard({
  name,
  description,
  price,
  currency = "MAD",
  image,
  badge,
  isLast = false,
  onClick,
  onAdd,
  quantity = 0,
  className,
}: MenuItemCardProps) {
  const handleClick = onAdd ?? onClick;
  const interactive = Boolean(handleClick);
  const hasBadge = quantity > 0;

  return (
    <article
      onClick={handleClick}
      role={onAdd ? "button" : undefined}
      tabIndex={onAdd ? 0 : undefined}
      onKeyDown={
        onAdd
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onAdd();
              }
            }
          : undefined
      }
      className={cn(
        "p-6 flex gap-4 hover:bg-black/[0.02] transition-colors group relative",
        interactive ? "cursor-pointer" : "",
        !isLast && "border-b border-outline",
        className,
      )}
    >
      <div className="absolute left-0 top-0 w-1 h-full bg-accent scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex justify-between items-start gap-4">
          <h3 className="text-[16px] font-bold leading-tight flex items-center gap-2">
            {name}
            {badge ? (
              <span className="bg-ink text-base text-[10px] uppercase font-mono px-1.5 py-0.5">
                {badge}
              </span>
            ) : null}
          </h3>
          <span className="font-mono text-[16px] font-bold whitespace-nowrap">
            {price}{" "}
            <span className="text-xs text-ink/50">{currency}</span>
          </span>
        </div>
        {description ? (
          <p className="text-[14px] text-ink/60 mt-2 leading-snug max-w-[90%]">
            {description}
          </p>
        ) : null}
      </div>
      {image ? (
        <div className="relative w-[80px] h-[80px] border border-ink flex-shrink-0 bg-outline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            alt={image.alt}
            className="w-full h-full object-cover brutalist-img"
          />
          {hasBadge ? <QuantityBadge quantity={quantity} /> : null}
        </div>
      ) : hasBadge ? (
        <div className="relative w-[80px] flex-shrink-0">
          <QuantityBadge quantity={quantity} />
        </div>
      ) : null}
    </article>
  );
}

function QuantityBadge({ quantity }: { quantity: number }) {
  return (
    <span
      className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 bg-accent text-base flex items-center justify-center font-mono font-bold text-[12px] border-2 border-base leading-none"
      aria-label={`${quantity} in cart`}
    >
      {quantity}
    </span>
  );
}
