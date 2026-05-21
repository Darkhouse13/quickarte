import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { paths } from "@quickarte/shared-types";
import { apiClient, readResponseProblem } from "../auth/api";

type CategoriesResponse =
  paths["/v1/menu/categories"]["get"]["responses"][200]["content"]["application/json"];
type Category = CategoriesResponse["categories"][number];
type ProductsResponse =
  paths["/v1/menu/products"]["get"]["responses"][200]["content"]["application/json"];
type Product = ProductsResponse["products"][number];
type ProductBody =
  paths["/v1/menu/products"]["post"]["requestBody"]["content"]["application/json"];
type VariantBody = ProductBody["variants"][number];
type ChannelKey = keyof ProductBody["channels"];
type LocaleCode = "fr" | "ar" | "es" | "en";

const localeTabs: LocaleCode[] = ["fr", "ar", "es", "en"];
const emptyVariant = (position: number): VariantBody => ({
  name: "",
  price: "",
  isDefault: position === 0,
  available: true,
  position,
  variantKind: "size",
  pricingMode: "fixed",
  displayPriceLabel: null,
  displayPriceMin: null,
  displayPriceMax: null,
  unitLabel: null,
});

type ProductForm = {
  id: string | null;
  categoryId: string | null;
  localizedNames: Record<string, string>;
  localizedDescriptions: Record<string, string>;
  basePrice: string;
  sku: string;
  itemCode: string;
  colorTag: string;
  featured: boolean;
  hidden: boolean;
  available: boolean;
  channels: ProductBody["channels"];
  variants: VariantBody[];
  imageUrl: string;
};

const emptyForm: ProductForm = {
  id: null,
  categoryId: null,
  localizedNames: { fr: "" },
  localizedDescriptions: {},
  basePrice: "0.00",
  sku: "",
  itemCode: "",
  colorTag: "",
  featured: false,
  hidden: false,
  available: true,
  channels: {
    dineIn: true,
    takeaway: true,
    delivery: true,
    qr: true,
    online: true,
  },
  variants: [emptyVariant(0)],
  imageUrl: "",
};

export function MenuCatalogPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [activeLocale, setActiveLocale] = useState<LocaleCode>("fr");
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [categoryName, setCategoryName] = useState("");
  const [subcategoryName, setSubcategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const flatCategories = useMemo(
    () => categories.flatMap((category) => [category, ...category.children]),
    [categories],
  );
  const visibleProducts = products.filter(
    (product) => !selectedCategoryId || product.categoryId === selectedCategoryId,
  );

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [categoryResponse, productResponse] = await Promise.all([
      apiClient().GET("/v1/menu/categories"),
      apiClient().GET("/v1/menu/products"),
    ]);
    setLoading(false);
    if (categoryResponse.error || !categoryResponse.data) {
      setError(t("admin.module3.catalog.loadError"));
      return;
    }
    if (productResponse.error || !productResponse.data) {
      setError(t("admin.module3.catalog.loadError"));
      return;
    }
    setCategories(categoryResponse.data.categories);
    setProducts(productResponse.data.products);
    setSelectedCategoryId(
      (current) => current ?? categoryResponse.data.categories[0]?.id ?? null,
    );
  }, [t]);

  useEffect(() => {
    void Promise.resolve().then(loadCatalog);
  }, [loadCatalog]);

  async function createCategory(parentId: string | null) {
    const name = parentId ? subcategoryName.trim() : categoryName.trim();
    if (!name) return;
    const response = await apiClient().POST("/v1/menu/categories", {
      body: {
        parentId,
        localizedNames: { fr: name },
        slug: slugify(name),
        position: parentId
          ? categories.find((category) => category.id === parentId)?.children.length ?? 0
          : categories.length,
      },
    });
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module3.catalog.saveError"));
      return;
    }
    setCategoryName("");
    setSubcategoryName("");
    await loadCatalog();
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const variants = normalizeVariants(form.variants);
    const primaryImage = form.imageUrl.trim();
    const body: ProductBody = {
      categoryId: form.categoryId,
      localizedNames: compactLocaleMap(form.localizedNames),
      localizedDescriptions: compactLocaleMap(form.localizedDescriptions),
      basePrice: form.basePrice || variants[0]?.price || "0.00",
      sku: emptyToNull(form.sku),
      itemCode: emptyToNull(form.itemCode),
      colorTag: emptyToNull(form.colorTag),
      featured: form.featured,
      hidden: form.hidden,
      available: form.available,
      channels: form.channels,
      position: form.id ? selectedProductPosition(form.id) : products.length,
      variants,
      images: primaryImage
        ? [{ url: primaryImage, altText: form.localizedNames.fr || null, position: 0, isPrimary: true }]
        : [],
    };

    const response = form.id
      ? await apiClient().PATCH("/v1/menu/products/{productId}", {
          params: { path: { productId: form.id } },
          body,
        })
      : await apiClient().POST("/v1/menu/products", { body });

    setSaving(false);
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module3.catalog.saveError"));
      return;
    }
    setMessage(t("admin.module3.catalog.saved"));
    setForm(emptyForm);
    await loadCatalog();
  }

  async function deleteProduct(productId: string) {
    if (!window.confirm(t("admin.module3.catalog.deleteConfirm"))) return;
    const response = await apiClient().DELETE("/v1/menu/products/{productId}", {
      params: { path: { productId } },
    });
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module3.catalog.saveError"));
      return;
    }
    await loadCatalog();
  }

  function selectedProductPosition(productId: string): number {
    return products.find((product) => product.id === productId)?.position ?? products.length;
  }

  function editProduct(product: Product) {
    setForm({
      id: product.id,
      categoryId: product.categoryId,
      localizedNames: { ...product.localizedNames, fr: product.localizedNames.fr ?? product.name },
      localizedDescriptions: {
        ...product.localizedDescriptions,
        fr: product.localizedDescriptions.fr ?? product.description ?? "",
      },
      basePrice: product.basePrice,
      sku: product.sku ?? "",
      itemCode: product.itemCode ?? "",
      colorTag: product.colorTag ?? "",
      featured: product.featured,
      hidden: product.hidden,
      available: product.available,
      channels: product.channels,
      variants: product.variants.map((variant, position) => ({
        id: variant.id ?? undefined,
        name: variant.synthetic ? "" : variant.name,
        price: variant.price,
        isDefault: variant.isDefault,
        available: variant.available,
        position,
        variantKind: variant.variantKind,
        pricingMode: variant.pricingMode,
        displayPriceLabel: variant.displayPriceLabel,
        displayPriceMin: variant.displayPriceMin,
        displayPriceMax: variant.displayPriceMax,
        unitLabel: variant.unitLabel,
      })),
      imageUrl: product.images.find((image) => image.isPrimary)?.url ?? product.image ?? "",
    });
  }

  function updateLocaleField(
    field: "localizedNames" | "localizedDescriptions",
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: { ...current[field], [activeLocale]: value },
    }));
  }

  function updateVariant(index: number, patch: Partial<VariantBody>) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, currentIndex) =>
        currentIndex === index
          ? { ...variant, ...patch }
          : patch.isDefault
            ? { ...variant, isDefault: false }
            : variant,
      ),
    }));
  }

  function addVariant() {
    setForm((current) => ({
      ...current,
      variants: [...current.variants, emptyVariant(current.variants.length)],
    }));
  }

  function removeVariant(index: number) {
    setForm((current) => {
      const next = current.variants.filter((_, currentIndex) => currentIndex !== index);
      return {
        ...current,
        variants: next.length > 0 ? next.map((variant, position) => ({ ...variant, position })) : [emptyVariant(0)],
      };
    });
  }

  function toggleChannel(channel: ChannelKey) {
    setForm((current) => ({
      ...current,
      channels: { ...current.channels, [channel]: !current.channels[channel] },
    }));
  }

  return (
    <section className="menu-builder-page">
      <div className="page-heading">
        <p className="eyebrow">{t("admin.module3.eyebrow")}</p>
        <h1>{t("admin.module3.catalog.title")}</h1>
      </div>
      {loading ? <p>{t("admin.dashboard.loading")}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

      <div className="menu-builder-grid">
        <aside className="category-rail">
          <div className="section-heading-row">
            <h2>{t("admin.module3.catalog.categories")}</h2>
            <button
              type="button"
              onClick={() => void createCategory(null)}
              disabled={!categoryName.trim()}
            >
              {t("admin.module3.catalog.add")}
            </button>
          </div>
          <input
            aria-label={t("admin.module3.catalog.categoryName")}
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder={t("admin.module3.catalog.categoryName")}
          />
          <div className="category-tree">
            {categories.map((category) => (
              <div key={category.id}>
                <button
                  className={selectedCategoryId === category.id ? "category-node active" : "category-node"}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(category.id);
                    setForm((current) => ({ ...current, categoryId: category.id }));
                  }}
                >
                  <span>{category.localizedNames.fr ?? category.name}</span>
                  <small>{category.children.length}</small>
                </button>
                {category.children.map((child) => (
                  <button
                    className={
                      selectedCategoryId === child.id
                        ? "category-node child active"
                        : "category-node child"
                    }
                    key={child.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(child.id);
                      setForm((current) => ({ ...current, categoryId: child.id }));
                    }}
                  >
                    {child.localizedNames.fr ?? child.name}
                  </button>
                ))}
                <div className="subcategory-add">
                  <input
                    aria-label={t("admin.module3.catalog.subcategoryName")}
                    value={selectedCategoryId === category.id ? subcategoryName : ""}
                    onChange={(event) => {
                      setSelectedCategoryId(category.id);
                      setSubcategoryName(event.target.value);
                    }}
                    placeholder={t("admin.module3.catalog.subcategoryName")}
                  />
                  <button
                    type="button"
                    onClick={() => void createCategory(category.id)}
                    disabled={selectedCategoryId !== category.id || !subcategoryName.trim()}
                  >
                    {t("admin.module3.catalog.add")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="catalog-list-panel">
          <div className="section-heading-row">
            <h2>{t("admin.module3.catalog.items")}</h2>
            <button type="button" onClick={() => setForm({ ...emptyForm, categoryId: selectedCategoryId })}>
              {t("admin.module3.catalog.newItem")}
            </button>
          </div>
          <div className="catalog-item-list">
            {visibleProducts.map((product) => (
              <article className="catalog-item-row" key={product.id}>
                <div>
                  <h3>{product.localizedNames.fr ?? product.name}</h3>
                  <p>{product.sku || product.itemCode || product.basePrice}</p>
                  <div className="variant-chip-row">
                    {product.variants.map((variant) => (
                      <span className="variant-chip" key={`${product.id}-${variant.id ?? "synthetic"}`}>
                        {variant.name}: {variant.price ?? variant.displayPriceLabel}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="row-actions">
                  {product.hidden ? <span className="status-pill">{t("admin.module3.catalog.hidden")}</span> : null}
                  <button type="button" onClick={() => editProduct(product)}>
                    {t("admin.module3.catalog.edit")}
                  </button>
                  <button className="button-secondary" type="button" onClick={() => void deleteProduct(product.id)}>
                    {t("admin.module3.catalog.delete")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <form className="item-editor-panel" onSubmit={(event) => void submitProduct(event)}>
          <div className="section-heading-row">
            <h2>{form.id ? t("admin.module3.catalog.editItem") : t("admin.module3.catalog.newItem")}</h2>
            <button disabled={saving} type="submit">
              {t("admin.module3.catalog.save")}
            </button>
          </div>

          <div className="locale-tabs" role="tablist" aria-label={t("admin.module3.catalog.locales")}>
            {localeTabs.map((locale) => (
              <button
                className={activeLocale === locale ? "active" : ""}
                key={locale}
                type="button"
                onClick={() => setActiveLocale(locale)}
              >
                {locale.toUpperCase()}
              </button>
            ))}
          </div>

          <div className={activeLocale === "ar" ? "editor-fields rtl-preview" : "editor-fields"}>
            <label>
              <span>{t("form.fields.name")} ({activeLocale.toUpperCase()})</span>
              <input
                dir={activeLocale === "ar" ? "rtl" : "ltr"}
                value={form.localizedNames[activeLocale] ?? ""}
                onChange={(event) => updateLocaleField("localizedNames", event.target.value)}
                required={activeLocale === "fr"}
              />
            </label>
            <label>
              <span>{t("form.fields.description")} ({activeLocale.toUpperCase()})</span>
              <input
                dir={activeLocale === "ar" ? "rtl" : "ltr"}
                value={form.localizedDescriptions[activeLocale] ?? ""}
                onChange={(event) =>
                  updateLocaleField("localizedDescriptions", event.target.value)
                }
              />
            </label>
          </div>

          <div className="editor-fields two">
            <label>
              <span>{t("admin.module3.catalog.category")}</span>
              <select
                value={form.categoryId ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    categoryId: event.target.value || null,
                  }))
                }
              >
                <option value="">{t("form.placeholders.selectCategory")}</option>
                {flatCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.localizedNames.fr ?? category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("admin.module3.catalog.basePrice")}</span>
              <input
                inputMode="decimal"
                value={form.basePrice}
                onChange={(event) => setForm((current) => ({ ...current, basePrice: event.target.value }))}
              />
            </label>
            <label>
              <span>{t("admin.module3.catalog.sku")}</span>
              <input value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} />
            </label>
            <label>
              <span>{t("admin.module3.catalog.image")}</span>
              <input value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} />
            </label>
          </div>

          <fieldset className="channel-toggles">
            <legend>{t("admin.module3.catalog.channels")}</legend>
            {(["dineIn", "takeaway", "delivery", "qr", "online"] as ChannelKey[]).map((channel) => (
              <label className="toggle-row" key={channel}>
                <input
                  type="checkbox"
                  checked={form.channels[channel]}
                  onChange={() => toggleChannel(channel)}
                />
                <span>{t(`admin.module3.catalog.channel.${channel}`)}</span>
              </label>
            ))}
          </fieldset>

          <section className="variant-grid-panel">
            <div className="section-heading-row">
              <h3>{t("admin.module3.catalog.variants")}</h3>
              <button type="button" onClick={addVariant}>
                {t("admin.module3.catalog.addVariant")}
              </button>
            </div>
            <div className="variant-grid">
              <span>{t("admin.module3.catalog.variantName")}</span>
              <span>{t("admin.module3.catalog.variantKind")}</span>
              <span>{t("admin.module3.catalog.price")}</span>
              <span>{t("admin.module3.catalog.market")}</span>
              <span>{t("admin.module3.catalog.default")}</span>
              <span />
              {form.variants.map((variant, index) => (
                <VariantRow
                  index={index}
                  key={`${index}-${variant.id ?? "new"}`}
                  onRemove={() => removeVariant(index)}
                  onUpdate={(patch) => updateVariant(index, patch)}
                  variant={variant}
                />
              ))}
            </div>
          </section>
        </form>
      </div>
    </section>
  );
}

function VariantRow({
  index,
  onRemove,
  onUpdate,
  variant,
}: {
  index: number;
  onRemove: () => void;
  onUpdate: (patch: Partial<VariantBody>) => void;
  variant: VariantBody;
}) {
  const { t } = useTranslation();
  return (
    <>
      <input
        aria-label={`${t("admin.module3.catalog.variantName")} ${index + 1}`}
        value={variant.name}
        onChange={(event) => onUpdate({ name: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <select
        value={variant.variantKind}
        onChange={(event) =>
          onUpdate({ variantKind: variantKindFromValue(event.target.value) })
        }
      >
        {["size", "protein", "topping", "market", "custom"].map((kind) => (
          <option key={kind} value={kind}>
            {t(`admin.module3.catalog.variantKindValue.${kind}`)}
          </option>
        ))}
      </select>
      <input
        aria-label={`${t("admin.module3.catalog.price")} ${index + 1}`}
        inputMode="decimal"
        disabled={variant.pricingMode === "variable_pos"}
        value={variant.price ?? ""}
        onChange={(event) => onUpdate({ price: event.target.value })}
      />
      <label className="toggle-row compact-toggle">
        <input
          type="checkbox"
          checked={variant.pricingMode === "variable_pos"}
          onChange={(event) =>
            onUpdate({
              pricingMode: event.target.checked ? "variable_pos" : "fixed",
              price: event.target.checked ? null : variant.price ?? "",
              displayPriceLabel: event.target.checked
                ? variant.displayPriceLabel ?? "Selon arrivage"
                : null,
            })
          }
        />
        <span>{variant.displayPriceLabel ?? t("admin.module3.catalog.variable")}</span>
      </label>
      <input
        type="radio"
        name="defaultVariant"
        checked={variant.isDefault}
        onChange={() => onUpdate({ isDefault: true })}
      />
      <button className="button-secondary" type="button" onClick={onRemove}>
        {t("admin.module3.catalog.remove")}
      </button>
    </>
  );
}

function normalizeVariants(variants: VariantBody[]): VariantBody[] {
  const visible = variants
    .filter((variant) => variant.name.trim())
    .map((variant, position) => ({ ...variant, position, name: variant.name.trim() }));
  if (visible.length === 0) return [emptyVariant(0)];
  const defaultIndex = visible.findIndex((variant) => variant.isDefault);
  return visible.map((variant, index) => ({
    ...variant,
    isDefault: defaultIndex === -1 ? index === 0 : index === defaultIndex,
  }));
}

function compactLocaleMap(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values)
      .map(([locale, value]) => [locale, value.trim()])
      .filter(([, value]) => value),
  );
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function variantKindFromValue(value: string): VariantBody["variantKind"] {
  if (value === "size" || value === "protein" || value === "topping" || value === "market") {
    return value;
  }
  return "custom";
}
