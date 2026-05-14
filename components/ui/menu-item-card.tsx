"use client";

import { cn } from "@/lib/utils/cn";
import { formatAmount } from "@/lib/utils/currency";

type MenuItemCardProps = {
  name: string;
  description?: string;
  price: number;
  priceLabel?: string;
  image?: { src: string; alt: string };
  badge?: string;
  isLast?: boolean;
  onClick?: () => void;
  onAdd?: () => void;
  onDecrease?: () => void;
  quantity?: number;
  flash?: boolean;
  className?: string;
};

export function MenuItemCard({
  name,
  description,
  price,
  priceLabel,
  image,
  badge,
  isLast = false,
  onClick,
  onAdd,
  onDecrease,
  quantity = 0,
  flash = false,
  className,
}: MenuItemCardProps) {
  const handleClick = onClick;
  const interactive = Boolean(handleClick);
  const hasBadge = quantity > 0;

  return (
    <article
      onClick={handleClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "p-6 flex gap-4 hover:bg-black/[0.02] transition-colors duration-300 group relative",
        interactive ? "cursor-pointer" : "",
        !isLast && "border-b border-outline",
        flash && "bg-accent/5",
        className,
      )}
    >
      <div className="absolute left-0 top-0 w-1 h-full bg-accent scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
      <div className="flex-1 flex flex-col justify-center min-w-0">
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
            {priceLabel ?? formatAmount(price)}
          </span>
        </div>
        {description ? (
          <p className="text-[14px] text-ink/60 mt-2 leading-snug max-w-[90%]">
            {description}
          </p>
        ) : null}
        {onAdd ? (
          <div className="mt-4">
            {quantity > 0 && onDecrease ? (
              <div className="inline-flex items-center border-2 border-ink h-10">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDecrease();
                  }}
                  aria-label="Diminuer"
                  className="w-10 h-full font-mono font-bold hover:bg-ink hover:text-base transition-colors"
                >
                  -
                </button>
                <span className="w-11 h-full flex items-center justify-center border-x-2 border-ink font-mono font-bold text-sm">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAdd();
                  }}
                  aria-label="Ajouter"
                  className="w-10 h-full font-mono font-bold hover:bg-ink hover:text-base transition-colors"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAdd();
                }}
                className="inline-flex items-center justify-center bg-ink text-base px-4 py-2.5 font-mono font-bold uppercase tracking-widest text-[11px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20"
              >
                + Ajouter
              </button>
            )}
          </div>
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
      aria-label={`${quantity} article${quantity > 1 ? "s" : ""} dans la commande`}
    >
      {quantity}
    </span>
  );
}
