"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { useCartStore } from "@/lib/ordering/cart-store";
import { placeOrder } from "@/lib/ordering/actions";
import { cn } from "@/lib/utils/cn";

type Props = {
  businessId: string;
  businessName: string;
  businessSlug: string;
  locale: string;
};

type OrderType = "dine_in" | "takeaway";

export function CheckoutForm({
  businessId,
  businessName,
  businessSlug,
  locale,
}: Props) {
  const router = useRouter();

  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const getTotal = useCartStore((s) => s.getTotal);
  const getItemCount = useCartStore((s) => s.getItemCount);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [tableNumber, setTableNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (hydrated && getItemCount() === 0 && !isPending) {
      router.replace(`/${locale}/${businessSlug}`);
    }
  }, [hydrated, getItemCount, isPending, router, locale, businessSlug]);

  const itemCount = hydrated ? getItemCount() : 0;
  const total = hydrated ? getTotal() : 0;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const payload = {
      businessId,
      customerName,
      customerPhone,
      orderType,
      tableNumber:
        orderType === "dine_in" && tableNumber.trim().length > 0
          ? Number(tableNumber)
          : undefined,
      notes: notes.trim().length > 0 ? notes : undefined,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    };

    startTransition(async () => {
      const result = await placeOrder(payload);
      if (result.status === "error") {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        setFormError(result.message);
        return;
      }
      clearCart();
      router.replace(
        `/${locale}/${businessSlug}/order/confirmation?orderId=${result.orderId}`,
      );
    });
  };

  const fieldError = (name: string): string | undefined =>
    fieldErrors[name]?.[0];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-screen">
      <header className="pt-8 px-6 pb-6 border-b-2 border-ink bg-base sticky top-0 z-20">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/${businessSlug}`)}
          className="font-mono text-[11px] uppercase tracking-widest text-ink/60 hover:text-ink flex items-center gap-2 mb-3"
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
          Retour au menu
        </button>
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Commande
        </h1>
        <p className="font-mono text-xs text-ink/60 mt-2 uppercase tracking-widest">
          {businessName}
        </p>
      </header>

      <section className="px-6 py-6 border-b-4 border-outline">
        <SectionLabel index={1} title="Articles" />
        <ul className="flex flex-col">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex gap-3 py-3 border-b border-outline last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold leading-tight truncate">
                  {item.name}
                </p>
                <p className="font-mono text-[12px] text-ink/50 mt-1">
                  {item.price} <span className="text-[10px]">MAD</span>
                </p>
              </div>
              <QuantityStepper
                quantity={item.quantity}
                onDecrease={() =>
                  updateQuantity(item.productId, item.quantity - 1)
                }
                onIncrease={() =>
                  updateQuantity(item.productId, item.quantity + 1)
                }
                onRemove={() => removeItem(item.productId)}
              />
              <div className="w-[70px] text-right font-mono font-bold text-[14px] self-center">
                {item.price * item.quantity}
                <span className="text-[10px] text-ink/50 ml-1">MAD</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="px-6 py-6 border-b-4 border-outline">
        <SectionLabel index={2} title="Mode" />
        <div className="grid grid-cols-2 gap-0 border-2 border-ink">
          <OrderTypeOption
            active={orderType === "dine_in"}
            label="Sur Place"
            sub="Dine-in"
            onClick={() => setOrderType("dine_in")}
          />
          <OrderTypeOption
            active={orderType === "takeaway"}
            label="À Emporter"
            sub="Takeaway"
            onClick={() => setOrderType("takeaway")}
            bordered
          />
        </div>

        {orderType === "dine_in" ? (
          <div className="mt-4">
            <FormInput
              label="Numéro de table"
              name="tableNumber"
              type="number"
              inputMode="numeric"
              placeholder="ex: 7"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              suffix="N°"
            />
            <FieldError message={fieldError("tableNumber")} />
          </div>
        ) : null}
      </section>

      <section className="px-6 py-6 border-b-4 border-outline">
        <SectionLabel index={3} title="Contact" />
        <div className="flex flex-col gap-4">
          <div>
            <FormInput
              label="Nom"
              name="customerName"
              placeholder="ex: Youssef"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              autoComplete="name"
            />
            <FieldError message={fieldError("customerName")} />
          </div>
          <div>
            <FormInput
              label="Téléphone"
              name="customerPhone"
              type="tel"
              placeholder="+212 6XX XXX XXX"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              autoComplete="tel"
            />
            <FieldError message={fieldError("customerPhone")} />
          </div>
        </div>
      </section>

      <section className="px-6 py-6 pb-32">
        <SectionLabel index={4} title="Notes" optional />
        <FormTextarea
          label="Instructions"
          name="notes"
          rows={3}
          placeholder="ex: Sans sucre, allergie aux arachides…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <FieldError message={fieldError("notes")} />
      </section>

      {formError ? (
        <div className="fixed bottom-[96px] left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="w-full max-w-[480px] bg-ink text-base border-2 border-ink px-4 py-3 pointer-events-auto">
            <p className="font-mono text-[11px] uppercase tracking-widest">
              {formError}
            </p>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-0 left-0 w-full z-50 flex justify-center pointer-events-none">
        <div className="w-full max-w-[480px] bg-base border-t-2 border-ink p-4 pointer-events-auto shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <button
            type="submit"
            disabled={isPending || itemCount === 0}
            className={cn(
              "w-full px-6 py-4 flex justify-between items-center border-2 border-transparent transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20",
              isPending
                ? "bg-ink text-base cursor-wait"
                : "bg-accent text-base hover:bg-ink hover:border-base",
            )}
          >
            <div className="flex flex-col items-start">
              <span className="font-bold uppercase tracking-widest text-sm">
                {isPending ? "Envoi…" : "Passer Commande"}
              </span>
              <span className="font-mono text-xs opacity-90 mt-0.5">
                {itemCount} {itemCount === 1 ? "ARTICLE" : "ARTICLES"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-lg">
                {total}{" "}
                <span className="text-sm font-sans font-normal">MAD</span>
              </span>
              {isPending ? (
                <Spinner />
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

function SectionLabel({
  index,
  title,
  optional,
}: {
  index: number;
  title: string;
  optional?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between mb-5">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] tracking-widest text-ink/40">
          0{index}
        </span>
        <h2 className="font-mono font-bold text-[14px] uppercase tracking-widest">
          {title}
        </h2>
      </div>
      {optional ? (
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
          Optionnel
        </span>
      ) : null}
    </div>
  );
}

function OrderTypeOption({
  active,
  label,
  sub,
  onClick,
  bordered,
}: {
  active: boolean;
  label: string;
  sub: string;
  onClick: () => void;
  bordered?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "py-4 flex flex-col items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/40",
        active ? "bg-ink text-base" : "bg-base text-ink hover:bg-black/[0.03]",
        bordered && "border-l-2 border-ink",
      )}
    >
      <span className="font-bold uppercase tracking-widest text-[13px]">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[10px] uppercase tracking-widest mt-1",
          active ? "text-base/60" : "text-ink/40",
        )}
      >
        {sub}
      </span>
    </button>
  );
}

function QuantityStepper({
  quantity,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center border border-ink h-8 self-center">
      <button
        type="button"
        onClick={quantity <= 1 ? onRemove : onDecrease}
        aria-label={quantity <= 1 ? "Retirer" : "Diminuer"}
        className="w-7 h-full flex items-center justify-center hover:bg-ink hover:text-base transition-colors"
      >
        {quantity <= 1 ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="square"
          >
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        ) : (
          <span className="font-mono font-bold text-sm leading-none">−</span>
        )}
      </button>
      <span className="w-7 text-center font-mono font-bold text-[13px]">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        aria-label="Augmenter"
        className="w-7 h-full flex items-center justify-center hover:bg-ink hover:text-base transition-colors"
      >
        <span className="font-mono font-bold text-sm leading-none">+</span>
      </button>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mt-2 font-mono text-[11px] uppercase tracking-widest text-accent"
    >
      {message}
    </p>
  );
}

function Spinner() {
  return (
    <span
      className="w-5 h-5 border-2 border-base border-t-transparent animate-spin inline-block"
      aria-hidden="true"
    />
  );
}
