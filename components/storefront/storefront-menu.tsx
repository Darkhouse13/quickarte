"use client";

import { useState } from "react";
import { CategoryPills } from "@/components/ui/category-pills";
import { MenuItemCard } from "@/components/ui/menu-item-card";
import { SectionHeader } from "@/components/ui/section-header";
import { BottomBar } from "@/components/ui/bottom-bar";
import type { StorefrontFixture } from "@/lib/catalog/fixtures";

type Props = {
  business: StorefrontFixture;
};

export function StorefrontMenu({ business }: Props) {
  const [activeCategory, setActiveCategory] = useState(
    business.sections[0]?.id ?? "",
  );

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
                {section.items.map((item, i) => (
                  <MenuItemCard
                    key={`${section.id}-${i}`}
                    name={item.name}
                    description={item.description}
                    price={item.price}
                    image={item.image}
                    badge={item.badge}
                    isLast={i === section.items.length - 1}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <BottomBar maxWidth={480} innerClassName="p-4">
        <button
          type="button"
          className="w-full bg-accent text-base px-6 py-4 flex justify-between items-center hover:bg-ink transition-colors border-2 border-transparent hover:border-base focus:outline-none focus:ring-4 focus:ring-accent/20"
        >
          <div className="flex flex-col items-start">
            <span className="font-bold uppercase tracking-widest text-sm">
              View Order
            </span>
            <span className="font-mono text-xs opacity-90 mt-0.5">3 ITEMS</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-lg">
              145 <span className="text-sm font-sans font-normal">MAD</span>
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
      </BottomBar>
    </>
  );
}
