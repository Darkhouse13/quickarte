"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryPills } from "@/components/ui/category-pills";
import { MenuItemCard } from "@/components/ui/menu-item-card";
import { SectionHeader } from "@/components/ui/section-header";
import { useCartStore } from "@/lib/ordering/cart-store";
import type { StorefrontFixture } from "@/lib/catalog/fixtures";

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

  const itemCount = hydrated ? getItemCount() : 0;
  const total = hydrated ? getTotal() : 0;
  const visible = itemCount > 0;

  const quantities = new Map(items.map((i) => [i.productId, i.quantity]));

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

      <div className="flex-1 pb-32">
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
                  return (
                    <MenuItemCard
                      key={item.productId ?? `${section.id}-${i}`}
                      name={item.name}
                      description={item.description}
                      price={item.price}
                      image={item.image}
                      badge={item.badge}
                      isLast={i === section.items.length - 1}
                      quantity={qty}
                      onAdd={
                        item.productId
                          ? () =>
                              addItem({
                                productId: item.productId!,
                                name: item.name,
                                price: item.price,
                                image: item.image?.src,
                              })
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
                View Order
              </span>
              <span className="font-mono text-xs opacity-90 mt-0.5">
                {itemCount} {itemCount === 1 ? "ITEM" : "ITEMS"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-lg">
                {total}{" "}
                <span className="text-sm font-sans font-normal">MAD</span>
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
