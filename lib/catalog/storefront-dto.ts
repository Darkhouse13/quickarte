import type { StorefrontFixture } from "./fixtures";
import type {
  BusinessWithSettings,
  StorefrontCategoryWithProducts,
} from "./queries";

export function buildStorefrontFixture(
  business: BusinessWithSettings,
  menu: StorefrontCategoryWithProducts[],
): StorefrontFixture {
  const location = [business.city, business.address].filter(Boolean).join(" · ");

  return {
    slug: business.slug,
    name: business.name,
    location,
    orderingEnabled:
      business.settings?.menuQrEnabled !== false &&
      business.settings?.orderingEnabled !== false,
    dineInEnabled: business.settings?.dineInEnabled !== false,
    takeawayEnabled: business.settings?.takeawayEnabled !== false,
    sections: menu.map((category) => ({
      id: category.id,
      label: category.name,
      items: category.products.map((product) => ({
        productId: product.id,
        name: product.name,
        description: product.description ?? "",
        price: Number(product.price),
        image: product.image
          ? { src: product.image, alt: product.name }
          : undefined,
        hasConfiguration:
          product.options.length > 0 || product.variants.length > 1,
        variants: product.variants.map((variant) => {
          const overrides = variant.optionMaxSelectionsOverrides ?? {};
          return {
            id: variant.id,
            name: variant.name,
            priceOverride:
              variant.priceOverride == null
                ? null
                : Number(variant.priceOverride),
            isDefault: variant.isDefault,
            available: variant.available,
            optionMaxSelectionsOverrides: overrides,
            option_max_selections_overrides: overrides,
          };
        }),
        options: product.options.map((option) => ({
          id: option.id,
          name: option.name,
          type: option.type,
          required: option.required,
          minSelect: option.minSelect,
          maxSelect: option.maxSelect,
          maxSelections: option.maxSelect,
          available: option.available,
          values: option.values.map((value) => ({
            id: value.id,
            name: value.name,
            priceAddition: Number(value.priceAddition),
            available: value.available,
            allowQuantity: value.allowQuantity,
            maxQuantity: value.maxQuantity ?? null,
          })),
        })),
      })),
    })),
  };
}
