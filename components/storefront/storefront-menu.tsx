"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { CategoryPills } from "@/components/ui/category-pills";
import { MenuItemCard } from "@/components/ui/menu-item-card";
import { SectionHeader } from "@/components/ui/section-header";
import { useCartStore, type CartItem } from "@/lib/ordering/cart-store";
import type {
  MenuItem,
  MenuItemOption,
  MenuItemOptionValue,
  StorefrontFixture,
} from "@/lib/catalog/fixtures";
import { formatAmount } from "@/lib/utils/currency";

type Props = {
  business: StorefrontFixture;
  locale: string;
};

export function StorefrontMenu({ business, locale }: Props) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState(
    business.sections[0]?.id ?? "",
  );

  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const getTotal = useCartStore((s) => s.getTotal);
  const getItemCount = useCartStore((s) => s.getItemCount);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const [flashId, setFlashId] = useState<string | null>(null);
  const [configuringItem, setConfiguringItem] = useState<MenuItem | null>(null);
  useEffect(() => {
    if (!flashId) return;
    const t = setTimeout(() => setFlashId(null), 280);
    return () => clearTimeout(t);
  }, [flashId]);

  const itemCount = hydrated ? getItemCount() : 0;
  const total = hydrated ? getTotal() : 0;
  const visible = itemCount > 0;

  const quantities = new Map(
    business.sections
      .flatMap((section) => section.items)
      .filter((item) => item.productId)
      .map((item) => [
        item.productId!,
        items
          .filter((cartItem) => cartItem.product_id === item.productId)
          .reduce((sum, cartItem) => sum + cartItem.quantity, 0),
      ]),
  );

  const totalItemCount = business.sections.reduce(
    (n, s) => n + s.items.length,
    0,
  );
  const menuEmpty = totalItemCount === 0;

  const handleSelect = (id: string) => {
    setActiveCategory(id);
    const el = document.getElementById(id);
    if (el) {
      const headerOffset = 170;
      const top =
        el.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-2 border-ink bg-base sticky top-0 z-20 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
              {business.name}
            </h1>
            <p className="font-mono text-xs text-ink/60 mt-2 uppercase tracking-widest">
              {business.location}
            </p>
          </div>
          <div className="w-10 h-10 bg-ink flex items-center justify-center flex-shrink-0">
            <div className="w-4 h-4 border-2 border-base" />
          </div>
        </div>
      </header>

      {business.description ? (
        <section className="px-6 py-6 border-b-4 border-outline bg-base">
          <div className="flex items-start gap-4">
            <span className="font-mono text-[9px] uppercase tracking-widest text-ink/40 font-bold pt-1 leading-none">
              A propos
            </span>
            <p className="text-[15px] leading-snug text-ink/80 font-sans">
              {business.description}
            </p>
          </div>
        </section>
      ) : null}

      {menuEmpty ? (
        <div className="flex-1 px-6 py-24 flex flex-col items-center text-center gap-4">
          <div className="w-10 h-10 border-2 border-ink" />
          <p className="font-sans text-[15px] text-ink/60 leading-snug max-w-[280px]">
            Le menu sera bientôt disponible
          </p>
        </div>
      ) : null}

      {!menuEmpty ? (
        <nav className="sticky top-[102px] z-10">
          <CategoryPills
            categories={business.sections.map((s) => ({
              id: s.id,
              label: s.label,
            }))}
            activeId={activeCategory}
            onSelect={handleSelect}
          />
        </nav>
      ) : null}

      <div className={menuEmpty ? "hidden" : "flex-1 pb-32"}>
        {business.sections.map((section, sectionIndex) => {
          const isLastSection = sectionIndex === business.sections.length - 1;
          return (
            <section
              key={section.id}
              id={section.id}
              className={isLastSection ? undefined : "border-b-4 border-outline"}
            >
              <SectionHeader index={sectionIndex + 1} title={section.label} />
              <div className="flex flex-col">
                {section.items.map((item, i) => {
                  const qty = item.productId
                    ? quantities.get(item.productId) ?? 0
                    : 0;
                  const isFlashing =
                    item.productId !== undefined && flashId === item.productId;
                  return (
                    <MenuItemCard
                      key={item.productId ?? `${section.id}-${i}`}
                      name={item.name}
                      description={item.description}
                      price={item.price}
                      priceLabel={getMenuPriceLabel(item)}
                      image={item.image}
                      badge={item.badge}
                      isLast={i === section.items.length - 1}
                      quantity={qty}
                      flash={isFlashing}
                      onAdd={
                        item.productId
                          ? () => {
                              if (hasCustomizations(item)) {
                                setConfiguringItem(item);
                                return;
                              }
                              addItem({
                                productId: item.productId!,
                                name: item.name,
                                price: item.price,
                                image: item.image?.src,
                              });
                              setFlashId(item.productId!);
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {configuringItem ? (
        <ProductConfigurationSheet
          item={configuringItem}
          onClose={() => setConfiguringItem(null)}
          onAdd={(line) => {
            addItem(line);
            setFlashId(configuringItem.productId ?? null);
            setConfiguringItem(null);
          }}
        />
      ) : null}

      <div
        className={`transition-transform duration-300 ease-out ${
          visible ? "translate-y-0" : "translate-y-full"
        } fixed bottom-0 left-0 w-full z-50 flex justify-center pointer-events-none`}
        aria-hidden={!visible}
      >
        <div className="w-full max-w-[480px] bg-base border-t-2 border-ink p-4 pointer-events-auto shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <button
            type="button"
            onClick={() =>
              router.push(`/${locale}/${business.slug}/order`)
            }
            disabled={!visible}
            className="w-full bg-accent text-base px-6 py-4 flex justify-between items-center hover:bg-ink transition-colors border-2 border-transparent hover:border-base focus:outline-none focus:ring-4 focus:ring-accent/20"
          >
            <div className="flex flex-col items-start">
              <span className="font-bold uppercase tracking-widest text-sm">
                Voir la commande
              </span>
              <span className="font-mono text-xs opacity-90 mt-0.5">
                {itemCount} {itemCount === 1 ? "ARTICLE" : "ARTICLES"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-lg">
                {formatAmount(total)}
              </span>
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
            </div>
          </button>
        </div>
      </div>

    </>
  );
}

function hasCustomizations(item: MenuItem): boolean {
  return Boolean(item.variants?.length || item.options?.length);
}

function getMenuPriceLabel(item: MenuItem): string {
  if (item.variants?.length) {
    const min = Math.min(
      ...item.variants.map((variant) => variant.priceOverride ?? item.price),
    );
    return `à partir de ${formatAmount(min)}`;
  }
  return formatAmount(item.price);
}

function ProductConfigurationSheet({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  onClose: () => void;
  onAdd: (line: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
}) {
  const variants = item.variants ?? [];
  const options = item.options ?? [];
  const [variantId, setVariantId] = useState<string | null>(
    variants[0]?.id ?? null,
  );
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);

  const selectedVariant =
    variants.find((variant) => variant.id === variantId) ?? null;
  const unitPrice =
    (selectedVariant?.priceOverride ?? item.price) +
    options.reduce((sum, option) => {
      const selectedIds = selected[option.id] ?? [];
      return (
        sum +
        option.values
          .filter((value) => selectedIds.includes(value.id))
          .reduce((optionSum, value) => optionSum + value.priceAddition, 0)
      );
    }, 0);

  const requiredSatisfied = options.every((option) => {
    if (!option.required) return true;
    const count = selected[option.id]?.length ?? 0;
    if (option.type === "single_select") return count === 1;
    return count >= 1;
  });

  const total = unitPrice * quantity;

  const selectValue = (option: MenuItemOption, value: MenuItemOptionValue) => {
    setSelected((prev) => {
      const current = prev[option.id] ?? [];
      if (option.type === "single_select") {
        return { ...prev, [option.id]: [value.id] };
      }
      if (current.includes(value.id)) {
        return {
          ...prev,
          [option.id]: current.filter((id) => id !== value.id),
        };
      }
      if (option.maxSelections && current.length >= option.maxSelections) {
        return prev;
      }
      return { ...prev, [option.id]: [...current, value.id] };
    });
  };

  const selectedOptionsSummary = options
    .map((option) => {
      const selectedIds = selected[option.id] ?? [];
      const values = option.values
        .filter((value) => selectedIds.includes(value.id))
        .map((value) => ({
          value_id: value.id,
          value_name: value.name,
          price_addition: value.priceAddition,
        }));
      return {
        option_id: option.id,
        option_name: option.name,
        option_type: option.type,
        values,
      };
    })
    .filter((option) => option.values.length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-ink/40">
      <div className="w-full max-w-[480px] bg-base min-h-screen md:min-h-0 md:my-8 md:border-2 md:border-ink flex flex-col relative">
        <header className="px-6 py-5 border-b-2 border-ink flex items-start justify-between gap-4">
          <div className="flex gap-4 min-w-0">
            {item.image ? (
              <div className="w-16 h-16 border border-ink bg-outline shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image.src}
                  alt={item.image.alt}
                  className="w-full h-full object-cover brutalist-img"
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <h2 className="font-sans text-xl font-black leading-tight text-ink">
                {item.name}
              </h2>
              <p className="font-mono text-xs text-ink/50 mt-2">
                {getMenuPriceLabel(item)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 border border-outline flex items-center justify-center text-ink hover:border-ink hover:text-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 pb-36 flex flex-col gap-7">
          {variants.length ? (
            <section>
              <BlockHeader title="Variantes" />
              <div className="mt-3 border border-outline">
                {variants.map((variant, index) => (
                  <ChoiceRow
                    key={variant.id}
                    type="radio"
                    name="variant"
                    checked={variantId === variant.id}
                    disabled={false}
                    label={variant.name}
                    priceLabel={formatAmount(variant.priceOverride ?? item.price)}
                    last={index === variants.length - 1}
                    onChange={() => setVariantId(variant.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {options.map((option) => {
            const selectedIds = selected[option.id] ?? [];
            const capReached = Boolean(
              option.type === "multi_select" &&
                option.maxSelections &&
                selectedIds.length >= option.maxSelections,
            );
            return (
              <section key={option.id}>
                <BlockHeader
                  title={option.name}
                  required={option.required}
                  maxSelections={
                    option.type === "multi_select"
                      ? option.maxSelections
                      : null
                  }
                />
                <div className="mt-3 border border-outline">
                  {option.values.map((value, index) => {
                    const checked = selectedIds.includes(value.id);
                    const disabled = capReached && !checked;
                    return (
                      <ChoiceRow
                        key={value.id}
                        type={
                          option.type === "single_select"
                            ? "radio"
                            : "checkbox"
                        }
                        name={option.id}
                        checked={checked}
                        disabled={disabled}
                        label={value.name}
                        priceLabel={
                          value.priceAddition > 0
                            ? `+${formatAmount(value.priceAddition)}`
                            : undefined
                        }
                        last={index === option.values.length - 1}
                        onChange={() => selectValue(option, value)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section>
            <BlockHeader title="Quantité" />
            <div className="mt-3 inline-flex border-2 border-ink">
              <button
                type="button"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-12 h-11 font-mono font-bold hover:bg-ink hover:text-base disabled:opacity-30"
              >
                -
              </button>
              <span className="w-14 h-11 flex items-center justify-center border-x-2 border-ink font-mono font-bold">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-12 h-11 font-mono font-bold hover:bg-ink hover:text-base"
              >
                +
              </button>
            </div>
          </section>
        </div>

        <div className="fixed bottom-0 left-0 w-full z-[70] flex justify-center pointer-events-none">
          <div className="w-full max-w-[480px] bg-base border-t-2 border-ink p-4 pointer-events-auto">
            <button
              type="button"
              disabled={!requiredSatisfied}
              onClick={() => {
                if (!item.productId) return;
                onAdd({
                  product_id: item.productId,
                  product_name: item.name,
                  quantity,
                  variant_id: selectedVariant?.id ?? null,
                  variant_name: selectedVariant?.name ?? null,
                  selected_option_value_ids: selectedOptionsSummary.flatMap(
                    (option) => option.values.map((value) => value.value_id),
                  ),
                  selected_options_summary: selectedOptionsSummary,
                  unit_price: roundMoney(unitPrice),
                  image: item.image?.src,
                });
              }}
              className="w-full bg-accent text-base px-6 py-4 flex justify-between items-center hover:bg-ink transition-colors border-2 border-transparent hover:border-base focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-50 disabled:hover:bg-accent disabled:hover:border-transparent"
            >
              <span className="font-bold uppercase tracking-widest text-sm">
                Ajouter
              </span>
              <span className="font-mono font-bold text-lg">
                {formatAmount(total)}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockHeader({
  title,
  required,
  maxSelections,
}: {
  title: string;
  required?: boolean;
  maxSelections?: number | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="font-mono text-[12px] uppercase tracking-widest font-bold text-ink">
        {title}
      </h3>
      <div className="flex items-center gap-2 shrink-0">
        {required ? (
          <span className="font-mono text-[9px] uppercase tracking-widest bg-ink text-base px-1.5 py-0.5">
            Requis
          </span>
        ) : null}
        {maxSelections ? (
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink/50">
            Au plus {maxSelections} choix
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ChoiceRow({
  type,
  name,
  checked,
  disabled,
  label,
  priceLabel,
  last,
  onChange,
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  disabled: boolean;
  label: string;
  priceLabel?: string;
  last: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 px-4 py-3 ${
        last ? "" : "border-b border-outline"
      } ${disabled ? "opacity-35" : "hover:bg-black/[0.02]"}`}
    >
      <span className="flex items-center gap-3 min-w-0">
        <input
          type={type}
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="w-4 h-4 accent-black"
        />
        <span className="font-sans text-sm font-bold text-ink truncate">
          {label}
        </span>
      </span>
      {priceLabel ? (
        <span className="font-mono text-[12px] text-ink/60 shrink-0">
          {priceLabel}
        </span>
      ) : null}
    </label>
  );
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
