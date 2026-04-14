import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { getAllProductsByBusinessId } from "@/lib/catalog/queries";
import { requireBusiness } from "@/lib/auth/get-business";
import { SectionHeader } from "@/components/ui/section-header";
import { BottomBar } from "@/components/ui/bottom-bar";
import { ProductAvailabilityToggle } from "@/components/merchant/product-availability-toggle";
import { cn } from "@/lib/utils/cn";

type Props = { params: Promise<{ locale: string }> };

export default async function CatalogIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { business } = await requireBusiness();
  const menu = await getAllProductsByBusinessId(business.id);
  const productCount = menu.reduce((n, c) => n + c.products.length, 0);

  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20 flex justify-between items-baseline">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Catalogue
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50 font-bold">
          {productCount} {productCount === 1 ? "article" : "articles"}
        </span>
      </header>

      <div className="flex-1 pb-32">
        {menu.map((category, ci) => (
          <section
            key={category.id}
            className={cn(
              ci !== menu.length - 1 && "border-b-4 border-outline",
            )}
          >
            <SectionHeader index={ci + 1} title={category.name} />

            {category.products.length === 0 ? (
              <p className="px-6 py-5 font-sans text-sm text-ink/40">
                Aucun article dans cette catégorie.
              </p>
            ) : (
              <div className="flex flex-col">
                {category.products.map((product, pi) => {
                  const isLast = pi === category.products.length - 1;
                  return (
                    <div
                      key={product.id}
                      className={cn(
                        "p-5 px-6 flex items-center justify-between gap-4 hover:bg-black/[0.02] transition-colors group relative",
                        !isLast && "border-b border-outline",
                        !product.available && "opacity-60",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute left-0 top-0 w-1 h-full scale-y-0 group-hover:scale-y-100 transition-transform origin-top",
                          product.available ? "bg-ink" : "bg-outline",
                        )}
                      />
                      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                        <span className="font-bold text-[15px] leading-tight truncate">
                          {product.name}
                        </span>
                        <span className="font-mono text-[12px] text-ink/50 leading-none">
                          {Number(product.price).toFixed(0)}{" "}
                          <span className="text-[10px] text-ink/40">MAD</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <ProductAvailabilityToggle
                          productId={product.id}
                          initial={product.available}
                        />
                        <Link
                          href={`/catalog/${product.id}`}
                          aria-label={`Modifier ${product.name}`}
                          className="font-mono text-ink/30 group-hover:text-ink transition-colors text-lg"
                        >
                          →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}

        {menu.length === 0 ? (
          <div className="p-8 text-center font-sans text-sm text-ink/50">
            Aucune catégorie. Lancez <code>npm run db:seed</code>.
          </div>
        ) : null}
      </div>

      <BottomBar maxWidth={480} className="bottom-[72px]">
        <Link
          href="/catalog/new"
          className="w-full bg-ink text-base px-6 py-4 flex justify-center items-center hover:bg-accent transition-colors border-2 border-transparent focus:outline-none focus:border-ink focus:ring-4 focus:ring-accent/20"
        >
          <span className="font-mono font-bold uppercase tracking-widest text-sm">
            + Nouvel Article
          </span>
        </Link>
      </BottomBar>
    </>
  );
}
