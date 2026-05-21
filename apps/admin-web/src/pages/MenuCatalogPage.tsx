import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { paths } from "@quickarte/shared-types";
import { apiClient, readResponseProblem } from "../auth/api";
import { BranchOverridePanel } from "./BranchOverridePanel";

type CategoriesResponse =
  paths["/v1/menu/categories"]["get"]["responses"][200]["content"]["application/json"];
type Category = CategoriesResponse["categories"][number];
type ProductsResponse =
  paths["/v1/menu/products"]["get"]["responses"][200]["content"]["application/json"];
type Product = ProductsResponse["products"][number];
type BranchesResponse =
  paths["/v1/branches"]["get"]["responses"][200]["content"]["application/json"];
type Branch = BranchesResponse["branches"][number];
type EffectiveMenuResponse =
  paths["/v1/branches/{branchId}/menu/effective"]["get"]["responses"][200]["content"]["application/json"];
type EffectiveProduct = EffectiveMenuResponse["categories"][number]["products"][number];
type MenuOverridesResponse =
  paths["/v1/branches/{branchId}/menu-overrides"]["get"]["responses"][200]["content"]["application/json"];
type TaxRatesResponse =
  paths["/v1/tax-rates"]["get"]["responses"][200]["content"]["application/json"];
type TaxRate = TaxRatesResponse["rates"][number];
type TagsResponse =
  paths["/v1/menu/tags"]["get"]["responses"][200]["content"]["application/json"];
type DietaryTag = TagsResponse["tags"][number];
type ModifierGroupsResponse =
  paths["/v1/menu/modifier-groups"]["get"]["responses"][200]["content"]["application/json"];
type ModifierTemplate = ModifierGroupsResponse["groups"][number];
type ProductBody =
  paths["/v1/menu/products"]["post"]["requestBody"]["content"]["application/json"];
type VariantBody = ProductBody["variants"][number];
type ModifierGroupBody =
  paths["/v1/menu/modifier-groups"]["post"]["requestBody"]["content"]["application/json"];
type ProductAvailabilityBody =
  paths["/v1/branches/{branchId}/products/{productId}/availability"]["patch"]["requestBody"]["content"]["application/json"];
type ProductPricesBody =
  paths["/v1/branches/{branchId}/products/{productId}/prices"]["put"]["requestBody"]["content"]["application/json"];
type MenuTaxOverridesBody =
  paths["/v1/branches/{branchId}/menu-tax-overrides"]["put"]["requestBody"]["content"]["application/json"];
type MenuPrintRoutesBody =
  paths["/v1/branches/{branchId}/menu-print-routes"]["put"]["requestBody"]["content"]["application/json"];
type AvailabilityWindowsBody =
  paths["/v1/menu/products/{productId}/availability-windows"]["put"]["requestBody"]["content"]["application/json"];
type AvailabilityWindowBody = AvailabilityWindowsBody["windows"][number];
type ChannelKey = keyof ProductBody["channels"];
type EffectiveChannelKey = keyof EffectiveProduct["channels"];
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
  spiceLevel: number | null;
  channels: ProductBody["channels"];
  variants: VariantBody[];
  imageUrl: string;
  modifierGroupIds: string[];
  tagIds: string[];
  availabilityWindows: AvailabilityWindowBody[];
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
  spiceLevel: null,
  channels: {
    dineIn: true,
    takeaway: true,
    delivery: true,
    qr: true,
    online: true,
  },
  variants: [emptyVariant(0)],
  imageUrl: "",
  modifierGroupIds: [],
  tagIds: [],
  availabilityWindows: [],
};

export function MenuCatalogPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [effectiveMenu, setEffectiveMenu] = useState<EffectiveMenuResponse | null>(null);
  const [menuOverrides, setMenuOverrides] = useState<MenuOverridesResponse | null>(null);
  const [effectiveChannel, setEffectiveChannel] = useState<EffectiveMenuResponse["channel"]>("pos");
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [tagCatalog, setTagCatalog] = useState<DietaryTag[]>([]);
  const [taxDrafts, setTaxDrafts] = useState<Record<string, string>>({});
  const [printDrafts, setPrintDrafts] = useState<Record<string, string[]>>({});
  const [modifierGroups, setModifierGroups] = useState<ModifierTemplate[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryModifierIds, setCategoryModifierIds] = useState<string[] | null>(null);
  const [activeLocale, setActiveLocale] = useState<LocaleCode>("fr");
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [modifierForm, setModifierForm] = useState<ModifierGroupBody>({
    localizedNames: { fr: "" },
    type: "multi_select",
    required: false,
    minSelect: 0,
    maxSelect: null,
    freeQuantity: 0,
    extraPrice: null,
    attachScope: "product",
    reusable: true,
    values: [
      {
        name: "",
        localizedNames: { fr: "" },
        priceAddition: "0.00",
        position: 0,
        available: true,
        recipeHookKey: null,
      },
    ],
  });
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
  const inheritedCategoryModifierIds = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .filter((product) => product.categoryId === selectedCategoryId)
            .flatMap((product) =>
              product.modifiers
                .filter((group) => group.source === "category" && group.templateId)
                .map((group) => group.templateId!),
            ),
        ),
      ),
    [products, selectedCategoryId],
  );
  const activeCategoryModifierIds = categoryModifierIds ?? inheritedCategoryModifierIds;

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [categoryResponse, productResponse, modifierResponse, branchResponse, taxResponse, tagResponse] = await Promise.all([
      apiClient().GET("/v1/menu/categories"),
      apiClient().GET("/v1/menu/products"),
      apiClient().GET("/v1/menu/modifier-groups"),
      apiClient().GET("/v1/branches"),
      apiClient().GET("/v1/tax-rates"),
      apiClient().GET("/v1/menu/tags"),
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
    if (modifierResponse.error || !modifierResponse.data) {
      setError(t("admin.module3.catalog.loadError"));
      return;
    }
    if (branchResponse.error || !branchResponse.data) {
      setError(t("admin.module3.catalog.loadError"));
      return;
    }
    if (taxResponse.error || !taxResponse.data) {
      setError(t("admin.module3.catalog.loadError"));
      return;
    }
    if (tagResponse.error || !tagResponse.data) {
      setError(t("admin.module3.catalog.loadError"));
      return;
    }
    setCategories(categoryResponse.data.categories);
    setProducts(productResponse.data.products);
    setModifierGroups(modifierResponse.data.groups);
    setBranches(branchResponse.data.branches);
    setTaxRates(taxResponse.data.rates);
    setTagCatalog(tagResponse.data.tags);
    setSelectedBranchId(
      (current) =>
        current ||
        branchResponse.data.branches.find((branch) => branch.isDefault)?.id ||
        branchResponse.data.branches[0]?.id ||
        "",
    );
    setSelectedCategoryId(
      (current) => current ?? categoryResponse.data.categories[0]?.id ?? null,
    );
  }, [t]);

  useEffect(() => {
    void Promise.resolve().then(loadCatalog);
  }, [loadCatalog]);

  const loadEffectiveMenu = useCallback(async () => {
    if (!selectedBranchId) return;
    const [response, overridesResponse] = await Promise.all([
      apiClient().GET("/v1/branches/{branchId}/menu/effective", {
        params: { path: { branchId: selectedBranchId }, query: { channel: effectiveChannel } },
      }),
      apiClient().GET("/v1/branches/{branchId}/menu-overrides", {
        params: { path: { branchId: selectedBranchId } },
      }),
    ]);
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module3.catalog.loadError"));
      return;
    }
    if (!overridesResponse.data) {
      setError(readResponseProblem(overridesResponse).detail ?? t("admin.module3.catalog.loadError"));
      return;
    }
    setEffectiveMenu(response.data);
    setMenuOverrides(overridesResponse.data);
    setPriceDrafts((current) => ({
      ...Object.fromEntries(
        response.data.categories
          .flatMap((category) => [category, ...category.children])
          .flatMap((category) => category.products)
          .flatMap((product) =>
            product.variants
              .filter((variant) => variant.id && variant.price)
              .map((variant) => [`${product.id}:${variant.id}`, variant.price ?? ""]),
          ),
      ),
      ...current,
    }));
    setTaxDrafts((current) => ({
      ...Object.fromEntries(
        response.data.categories
          .flatMap((category) => [category, ...category.children])
          .flatMap((category) => category.products)
          .map((product) => [product.id, product.effectiveTaxRateId]),
      ),
      ...current,
    }));
    setPrintDrafts((current) => ({
      ...Object.fromEntries(
        response.data.categories
          .flatMap((category) => [category, ...category.children])
          .flatMap((category) => category.products)
          .map((product) => [product.id, product.printStations]),
      ),
      ...current,
    }));
  }, [effectiveChannel, selectedBranchId, t]);

  useEffect(() => {
    void Promise.resolve().then(loadEffectiveMenu);
  }, [loadEffectiveMenu]);

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
      spiceLevel: form.spiceLevel,
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
    const productId = response.data.product.id;
    const [modifierResponse, tagResponse, windowResponse] = await Promise.all([
      apiClient().PUT("/v1/menu/products/{productId}/modifier-groups", {
        params: { path: { productId } },
        body: { groupTemplateIds: form.modifierGroupIds },
      }),
      apiClient().PUT("/v1/menu/products/{productId}/tags", {
        params: { path: { productId } },
        body: { tagIds: form.tagIds },
      }),
      apiClient().PUT("/v1/menu/products/{productId}/availability-windows", {
        params: { path: { productId } },
        body: { windows: normalizeWindows(form.availabilityWindows) },
      }),
    ]);
    const saveProblem =
      !modifierResponse.data ? modifierResponse : !tagResponse.data ? tagResponse : !windowResponse.data ? windowResponse : null;
    if (saveProblem) {
      setError(readResponseProblem(saveProblem).detail ?? t("admin.module3.catalog.saveError"));
      return;
    }
    setMessage(t("admin.module3.catalog.saved"));
    setForm(emptyForm);
    await loadCatalog();
  }

  async function saveCategoryModifiers() {
    if (!selectedCategoryId) return;
    const response = await apiClient().PUT(
      "/v1/menu/categories/{categoryId}/modifier-groups",
      {
        params: { path: { categoryId: selectedCategoryId } },
        body: { groupTemplateIds: activeCategoryModifierIds },
      },
    );
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module3.catalog.saveError"));
      return;
    }
    setMessage(t("admin.module3.catalog.saved"));
    await loadCatalog();
  }

  async function createModifierGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = modifierForm.values
      .filter((value) => value.name.trim() || value.localizedNames.fr?.trim())
      .map((value, position) => ({
        ...value,
        name: value.name.trim() || value.localizedNames.fr?.trim() || "",
        localizedNames: compactLocaleMap(value.localizedNames),
        priceAddition: value.priceAddition || "0.00",
        position,
      }));
    if (!modifierForm.localizedNames.fr?.trim() || values.length === 0) return;
    const response = await apiClient().POST("/v1/menu/modifier-groups", {
      body: {
        ...modifierForm,
        localizedNames: compactLocaleMap(modifierForm.localizedNames),
        name: modifierForm.localizedNames.fr,
        extraPrice: modifierForm.extraPrice || null,
        values,
      },
    });
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module3.catalog.saveError"));
      return;
    }
    setModifierForm({
      localizedNames: { fr: "" },
      type: "multi_select",
      required: false,
      minSelect: 0,
      maxSelect: null,
      freeQuantity: 0,
      extraPrice: null,
      attachScope: "product",
      reusable: true,
      values: [
        {
          name: "",
          localizedNames: { fr: "" },
          priceAddition: "0.00",
          position: 0,
          available: true,
          recipeHookKey: null,
        },
      ],
    });
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

  async function toggleBranchAvailability(product: EffectiveProduct) {
    if (!selectedBranchId) return;
    const nextIs86d = !product.is86d;
    const reason = nextIs86d ? window.prompt(t("admin.module3.overrides.reasonPrompt")) : null;
    const body: ProductAvailabilityBody = {
      is86d: nextIs86d,
      eightySixedReason: nextIs86d ? reason || t("admin.module3.overrides.noReason") : null,
    };
    const response = await apiClient().PATCH(
      "/v1/branches/{branchId}/products/{productId}/availability",
      {
        params: { path: { branchId: selectedBranchId, productId: product.id } },
        body,
      },
    );
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module3.catalog.saveError"));
      return;
    }
    await loadEffectiveMenu();
  }

  async function toggleBranchChannel(product: EffectiveProduct, channel: EffectiveChannelKey) {
    if (!selectedBranchId) return;
    const body: ProductAvailabilityBody = {
      channels: { [channel]: !product.channels[channel] },
    };
    const response = await apiClient().PATCH(
      "/v1/branches/{branchId}/products/{productId}/availability",
      {
        params: { path: { branchId: selectedBranchId, productId: product.id } },
        body,
      },
    );
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module3.catalog.saveError"));
      return;
    }
    await loadEffectiveMenu();
  }

  async function saveBranchPrices(product: EffectiveProduct) {
    if (!selectedBranchId) return;
    const prices: ProductPricesBody["prices"] = product.variants
      .filter((variant) => variant.id)
      .map((variant) => ({
        variantId: variant.id!,
        price: priceDrafts[`${product.id}:${variant.id}`] || variant.price || "0.00",
      }));
    const response = await apiClient().PUT(
      "/v1/branches/{branchId}/products/{productId}/prices",
      {
        params: { path: { branchId: selectedBranchId, productId: product.id } },
        body: { prices },
      },
    );
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module3.catalog.saveError"));
      return;
    }
    await loadEffectiveMenu();
  }

  async function saveProductTaxOverride(product: EffectiveProduct) {
    if (!selectedBranchId || !menuOverrides) return;
    const taxRateId = taxDrafts[product.id] || product.effectiveTaxRateId;
    const productTaxOverrides: MenuTaxOverridesBody["productTaxOverrides"] = [
      ...menuOverrides.productTaxOverrides.filter((row) => row.productId !== product.id),
      { productId: product.id, taxRateId },
    ];
    const response = await apiClient().PUT("/v1/branches/{branchId}/menu-tax-overrides", {
      params: { path: { branchId: selectedBranchId } },
      body: {
        categoryTaxOverrides: menuOverrides.categoryTaxOverrides,
        productTaxOverrides,
      },
    });
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module3.catalog.saveError"));
      return;
    }
    await loadEffectiveMenu();
  }

  async function saveProductPrintRoutes(product: EffectiveProduct) {
    if (!selectedBranchId || !menuOverrides) return;
    const stations = printDrafts[product.id] ?? product.printStations;
    const productPrintRoutes: MenuPrintRoutesBody["productPrintRoutes"] = [
      ...menuOverrides.productPrintRoutes.filter((row) => row.productId !== product.id),
      { productId: product.id, stations },
    ];
    const response = await apiClient().PUT("/v1/branches/{branchId}/menu-print-routes", {
      params: { path: { branchId: selectedBranchId } },
      body: {
        categoryPrintRoutes: menuOverrides.categoryPrintRoutes,
        productPrintRoutes,
      },
    });
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module3.catalog.saveError"));
      return;
    }
    await loadEffectiveMenu();
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
      spiceLevel: product.spiceLevel,
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
      modifierGroupIds: product.modifiers
        .filter((group) => group.source === "product" && group.templateId)
        .map((group) => group.templateId!),
      tagIds: product.tags.map((tag) => tag.id),
      availabilityWindows: product.availabilityWindows.map((window) => ({
        dayOfWeek: window.dayOfWeek,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
      })),
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

  function toggleProductModifier(groupId: string) {
    setForm((current) => ({
      ...current,
      modifierGroupIds: toggleId(current.modifierGroupIds, groupId),
    }));
  }

  function toggleProductTag(tagId: string) {
    setForm((current) => ({
      ...current,
      tagIds: toggleId(current.tagIds, tagId),
    }));
  }

  function addAvailabilityWindow() {
    setForm((current) => ({
      ...current,
      availabilityWindows: [
        ...current.availabilityWindows,
        { dayOfWeek: 5, startMinute: 12 * 60, endMinute: 14 * 60 },
      ],
    }));
  }

  function updateAvailabilityWindow(index: number, patch: Partial<AvailabilityWindowBody>) {
    setForm((current) => ({
      ...current,
      availabilityWindows: current.availabilityWindows.map((window, currentIndex) =>
        currentIndex === index ? { ...window, ...patch } : window,
      ),
    }));
  }

  function removeAvailabilityWindow(index: number) {
    setForm((current) => ({
      ...current,
      availabilityWindows: current.availabilityWindows.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  function toggleCategoryModifier(groupId: string) {
    setCategoryModifierIds((current) => toggleId(current ?? inheritedCategoryModifierIds, groupId));
  }

  function addModifierValueRow() {
    setModifierForm((current) => ({
      ...current,
      values: [
        ...current.values,
        {
          name: "",
          localizedNames: { fr: "" },
          priceAddition: "0.00",
          position: current.values.length,
          available: true,
          recipeHookKey: null,
        },
      ],
    }));
  }

  function updateModifierValue(index: number, patch: Partial<ModifierGroupBody["values"][number]>) {
    setModifierForm((current) => ({
      ...current,
      values: current.values.map((value, currentIndex) =>
        currentIndex === index ? { ...value, ...patch } : value,
      ),
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
                    setCategoryModifierIds(null);
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
                      setCategoryModifierIds(null);
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
                      setCategoryModifierIds(null);
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
          <BranchOverridePanel
            branches={branches}
            effectiveChannel={effectiveChannel}
            effectiveMenu={effectiveMenu}
            priceDrafts={priceDrafts}
            printDrafts={printDrafts}
            selectedBranchId={selectedBranchId}
            taxDrafts={taxDrafts}
            taxRates={taxRates}
            onBranchChange={setSelectedBranchId}
            onChannelChange={setEffectiveChannel}
            onPriceDraftChange={(key, value) =>
              setPriceDrafts((current) => ({ ...current, [key]: value }))
            }
            onPrintDraftChange={(productId, stations) =>
              setPrintDrafts((current) => ({ ...current, [productId]: stations }))
            }
            onSavePrices={saveBranchPrices}
            onSavePrintRoutes={saveProductPrintRoutes}
            onSaveTax={saveProductTaxOverride}
            onTaxDraftChange={(productId, taxRateId) =>
              setTaxDrafts((current) => ({ ...current, [productId]: taxRateId }))
            }
            onToggleAvailability={toggleBranchAvailability}
            onToggleChannel={toggleBranchChannel}
          />
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

          <section className="menu-tags-panel">
            <div className="section-heading-row">
              <h3>{t("admin.module3.catalog.tagsAndAvailability")}</h3>
              <span className="status-pill">{t("admin.module3.catalog.productScope")}</span>
            </div>
            <div className="editor-fields two">
              <label>
                <span>{t("admin.module3.catalog.spiceLevel")}</span>
                <select
                  value={form.spiceLevel ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      spiceLevel: event.target.value === "" ? null : Number(event.target.value),
                    }))
                  }
                >
                  <option value="">{t("admin.module3.catalog.noSpiceLevel")}</option>
                  {[0, 1, 2, 3].map((level) => (
                    <option key={level} value={level}>
                      {t(`admin.module3.catalog.spice.${level}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="tag-picker-grid">
              {tagCatalog.map((tag) => (
                <label className="toggle-row modifier-choice" key={tag.id}>
                  <input
                    checked={form.tagIds.includes(tag.id)}
                    type="checkbox"
                    onChange={() => toggleProductTag(tag.id)}
                  />
                  <span>
                    {tag.localizedLabels.fr ?? tag.code}
                    <small>{t(`admin.module3.catalog.tagKind.${tag.kind}`)}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="section-heading-row">
              <h4>{t("admin.module3.catalog.availabilityWindows")}</h4>
              <button className="button-secondary" type="button" onClick={addAvailabilityWindow}>
                {t("admin.module3.catalog.addWindow")}
              </button>
            </div>
            <div className="availability-window-grid">
              {form.availabilityWindows.map((window, index) => (
                <div className="availability-window-row" key={index}>
                  <select
                    value={window.dayOfWeek}
                    onChange={(event) =>
                      updateAvailabilityWindow(index, {
                        dayOfWeek: Number.parseInt(event.target.value, 10),
                      })
                    }
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                      <option key={day} value={day}>
                        {t(`admin.module3.catalog.day.${day}`)}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={t("admin.module3.catalog.windowStart")}
                    type="time"
                    value={minuteToTime(window.startMinute)}
                    onChange={(event) =>
                      updateAvailabilityWindow(index, {
                        startMinute: timeToMinute(event.target.value),
                      })
                    }
                  />
                  <input
                    aria-label={t("admin.module3.catalog.windowEnd")}
                    type="time"
                    value={minuteToTime(window.endMinute)}
                    onChange={(event) =>
                      updateAvailabilityWindow(index, {
                        endMinute: timeToMinute(event.target.value),
                      })
                    }
                  />
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => removeAvailabilityWindow(index)}
                  >
                    {t("admin.module3.catalog.remove")}
                  </button>
                </div>
              ))}
              {form.availabilityWindows.length === 0 ? (
                <p className="helper-copy">{t("admin.module3.catalog.alwaysAvailable")}</p>
              ) : null}
            </div>
          </section>

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

          <section className="modifier-panel">
            <div className="section-heading-row">
              <h3>{t("admin.module3.catalog.modifiers")}</h3>
              <span className="status-pill">{t("admin.module3.catalog.productScope")}</span>
            </div>
            <div className="modifier-checklist">
              {modifierGroups.map((group) => (
                <label className="toggle-row modifier-choice" key={group.id}>
                  <input
                    checked={form.modifierGroupIds.includes(group.id)}
                    type="checkbox"
                    onChange={() => toggleProductModifier(group.id)}
                  />
                  <span>
                    {group.localizedNames.fr ?? group.name}
                    {group.freeQuantity > 0
                      ? ` - ${group.freeQuantity} ${t("admin.module3.catalog.freeThen")} ${group.extraPrice ?? "0.00"}`
                      : ""}
                  </span>
                </label>
              ))}
            </div>
            {form.id
              ? products
                  .find((product) => product.id === form.id)
                  ?.modifiers.filter((group) => group.source === "category")
                  .map((group) => (
                    <span className="inherited-badge" key={`${group.sourceCategoryId}-${group.id}`}>
                      {group.name} - {t("admin.module3.catalog.inheritedFrom")} - {group.sourceCategoryName}
                    </span>
                  ))
              : null}
          </section>
        </form>

        <aside className="modifier-library-panel">
          <form onSubmit={(event) => void createModifierGroup(event)}>
            <div className="section-heading-row">
              <h2>{t("admin.module3.catalog.modifierLibrary")}</h2>
              <button type="submit">{t("admin.module3.catalog.add")}</button>
            </div>
            <label>
              <span>{t("admin.module3.catalog.groupName")}</span>
              <input
                value={modifierForm.localizedNames.fr ?? ""}
                onChange={(event) =>
                  setModifierForm((current) => ({
                    ...current,
                    localizedNames: { ...current.localizedNames, fr: event.target.value },
                  }))
                }
              />
            </label>
            <div className="editor-fields two">
              <label>
                <span>{t("admin.module3.catalog.groupType")}</span>
                <select
                  value={modifierForm.type}
                  onChange={(event) =>
                    setModifierForm((current) => ({
                      ...current,
                      type: event.target.value === "single_select" ? "single_select" : "multi_select",
                    }))
                  }
                >
                  <option value="single_select">{t("admin.module3.catalog.singleSelect")}</option>
                  <option value="multi_select">{t("admin.module3.catalog.multiSelect")}</option>
                </select>
              </label>
              <label>
                <span>{t("admin.module3.catalog.freeQuantity")}</span>
                <input
                  inputMode="numeric"
                  value={modifierForm.freeQuantity}
                  onChange={(event) =>
                    setModifierForm((current) => ({
                      ...current,
                      freeQuantity: Number.parseInt(event.target.value || "0", 10),
                    }))
                  }
                />
              </label>
              <label>
                <span>{t("admin.module3.catalog.extraPrice")}</span>
                <input
                  inputMode="decimal"
                  value={modifierForm.extraPrice ?? ""}
                  onChange={(event) =>
                    setModifierForm((current) => ({
                      ...current,
                      extraPrice: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="toggle-row">
                <input
                  checked={modifierForm.required}
                  type="checkbox"
                  onChange={() =>
                    setModifierForm((current) => ({
                      ...current,
                      required: !current.required,
                      minSelect: !current.required ? 1 : 0,
                    }))
                  }
                />
                <span>{t("admin.module3.catalog.required")}</span>
              </label>
            </div>
            <div className="modifier-values-grid">
              <span>{t("admin.module3.catalog.optionName")}</span>
              <span>{t("admin.module3.catalog.priceAddition")}</span>
              <span>{t("admin.module3.catalog.recipeHook")}</span>
              {modifierForm.values.map((value, index) => (
                <div className="modifier-value-row" key={index}>
                  <input
                    value={value.localizedNames.fr ?? ""}
                    onChange={(event) =>
                      updateModifierValue(index, {
                        name: event.target.value,
                        localizedNames: { ...value.localizedNames, fr: event.target.value },
                      })
                    }
                  />
                  <input
                    inputMode="decimal"
                    value={value.priceAddition}
                    onChange={(event) =>
                      updateModifierValue(index, { priceAddition: event.target.value })
                    }
                  />
                  <input
                    value={value.recipeHookKey ?? ""}
                    onChange={(event) =>
                      updateModifierValue(index, {
                        recipeHookKey: event.target.value || null,
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <button className="button-secondary" type="button" onClick={addModifierValueRow}>
              {t("admin.module3.catalog.addOption")}
            </button>
          </form>

          <div className="category-modifier-box">
            <div className="section-heading-row">
              <h3>{t("admin.module3.catalog.categoryScope")}</h3>
              <button
                disabled={!selectedCategoryId}
                type="button"
                onClick={() => void saveCategoryModifiers()}
              >
                {t("admin.module3.catalog.save")}
              </button>
            </div>
            {modifierGroups.map((group) => (
              <label className="toggle-row modifier-choice" key={`category-${group.id}`}>
                <input
                  checked={activeCategoryModifierIds.includes(group.id)}
                  type="checkbox"
                  onChange={() => toggleCategoryModifier(group.id)}
                />
                <span>{group.localizedNames.fr ?? group.name}</span>
              </label>
            ))}
          </div>
        </aside>
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

function normalizeWindows(windows: AvailabilityWindowBody[]): AvailabilityWindowBody[] {
  return windows.map((window) => ({
    dayOfWeek: window.dayOfWeek,
    startMinute: clampMinute(window.startMinute),
    endMinute: clampMinute(window.endMinute),
  }));
}

function minuteToTime(minute: number): string {
  const clamped = clampMinute(minute);
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinute(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return clampMinute(Number.parseInt(hours, 10) * 60 + Number.parseInt(minutes, 10));
}

function clampMinute(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1439, Math.trunc(value)));
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

function toggleId(values: string[], id: string): string[] {
  return values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
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
