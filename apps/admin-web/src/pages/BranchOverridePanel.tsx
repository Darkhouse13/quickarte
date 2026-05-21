import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { paths } from "@quickarte/shared-types";

type BranchesResponse =
  paths["/v1/branches"]["get"]["responses"][200]["content"]["application/json"];
type Branch = BranchesResponse["branches"][number];
type EffectiveMenuResponse =
  paths["/v1/branches/{branchId}/menu/effective"]["get"]["responses"][200]["content"]["application/json"];
type EffectiveProduct = EffectiveMenuResponse["categories"][number]["products"][number];
type EffectiveChannelKey = keyof EffectiveProduct["channels"];
type TaxRatesResponse =
  paths["/v1/tax-rates"]["get"]["responses"][200]["content"]["application/json"];
type TaxRate = TaxRatesResponse["rates"][number];

type BranchOverridePanelProps = {
  branches: Branch[];
  effectiveChannel: EffectiveMenuResponse["channel"];
  effectiveMenu: EffectiveMenuResponse | null;
  priceDrafts: Record<string, string>;
  printDrafts: Record<string, string[]>;
  selectedBranchId: string;
  taxDrafts: Record<string, string>;
  taxRates: TaxRate[];
  onBranchChange: (branchId: string) => void;
  onChannelChange: (channel: EffectiveMenuResponse["channel"]) => void;
  onPriceDraftChange: (key: string, value: string) => void;
  onPrintDraftChange: (productId: string, stations: string[]) => void;
  onSavePrices: (product: EffectiveProduct) => Promise<void>;
  onSavePrintRoutes: (product: EffectiveProduct) => Promise<void>;
  onSaveTax: (product: EffectiveProduct) => Promise<void>;
  onTaxDraftChange: (productId: string, taxRateId: string) => void;
  onToggleAvailability: (product: EffectiveProduct) => Promise<void>;
  onToggleChannel: (product: EffectiveProduct, channel: EffectiveChannelKey) => Promise<void>;
};

const menuChannels: EffectiveMenuResponse["channel"][] = [
  "pos",
  "qr",
  "dine_in",
  "takeaway",
  "delivery",
  "online",
];
const productChannels: EffectiveChannelKey[] = [
  "dineIn",
  "takeaway",
  "delivery",
  "qr",
  "online",
];
const printStations = ["bar", "counter", "kitchen"];

export function BranchOverridePanel({
  branches,
  effectiveChannel,
  effectiveMenu,
  priceDrafts,
  printDrafts,
  selectedBranchId,
  taxDrafts,
  taxRates,
  onBranchChange,
  onChannelChange,
  onPriceDraftChange,
  onPrintDraftChange,
  onSavePrices,
  onSavePrintRoutes,
  onSaveTax,
  onTaxDraftChange,
  onToggleAvailability,
  onToggleChannel,
}: BranchOverridePanelProps) {
  const { t } = useTranslation();
  const effectiveProducts = useMemo(
    () =>
      effectiveMenu
        ? effectiveMenu.categories
            .flatMap((category) => [category, ...category.children])
            .flatMap((category) => category.products)
        : [],
    [effectiveMenu],
  );

  return (
    <div className="branch-override-panel">
      <div className="section-heading-row">
        <div>
          <h2>{t("admin.module3.overrides.title")}</h2>
          <p>{t("admin.module3.overrides.warning")}</p>
        </div>
        <select
          aria-label={t("admin.module3.overrides.branch")}
          value={selectedBranchId}
          onChange={(event) => onBranchChange(event.target.value)}
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>
      <div className="override-toolbar">
        {menuChannels.map((channel) => (
          <button
            className={effectiveChannel === channel ? "active" : ""}
            key={channel}
            type="button"
            onClick={() => onChannelChange(channel)}
          >
            {t(`admin.module3.overrides.channel.${channel}`)}
          </button>
        ))}
      </div>
      <div className="branch-effective-list">
        {effectiveProducts.map((product) => (
          <article
            className={product.is86d ? "branch-effective-card disabled" : "branch-effective-card"}
            key={product.id}
          >
            <div>
              <h3>{product.localizedNames.fr ?? product.name}</h3>
              <div className="variant-chip-row">
                <span
                  className={
                    product.availableSource === "overridden"
                      ? "status-pill override"
                      : "status-pill"
                  }
                >
                  {product.availableSource === "overridden"
                    ? t("admin.module3.overrides.overridden")
                    : t("admin.module3.overrides.inherited")}
                </span>
                {product.is86d ? <span className="status-pill danger">86</span> : null}
                {product.variants.map((variant) => (
                  <span
                    className={
                      variant.priceSource === "overridden"
                        ? "variant-chip override"
                        : "variant-chip"
                    }
                    key={variant.id ?? "synthetic"}
                  >
                    {variant.name}: {variant.price ?? variant.displayPriceLabel}
                  </span>
                ))}
              </div>
            </div>
            <div className="branch-override-actions">
              <button type="button" onClick={() => void onToggleAvailability(product)}>
                {product.is86d
                  ? t("admin.module3.overrides.restore")
                  : t("admin.module3.overrides.eightySix")}
              </button>
              {productChannels.map((channel) => (
                <label className="toggle-row compact-toggle" key={`${product.id}-${channel}`}>
                  <input
                    checked={product.channels[channel]}
                    type="checkbox"
                    onChange={() => void onToggleChannel(product, channel)}
                  />
                  <span>{t(`admin.module3.catalog.channel.${channel}`)}</span>
                </label>
              ))}
              {product.variants
                .filter((variant) => variant.id)
                .map((variant) => {
                  const priceKey = `${product.id}:${variant.id}`;
                  return (
                    <label className="branch-price-input" key={priceKey}>
                      <span>{variant.name}</span>
                      <input
                        inputMode="decimal"
                        value={priceDrafts[priceKey] ?? variant.price ?? ""}
                        onChange={(event) => onPriceDraftChange(priceKey, event.target.value)}
                      />
                    </label>
                  );
                })}
              <button
                className="button-secondary"
                type="button"
                onClick={() => void onSavePrices(product)}
              >
                {t("admin.module3.overrides.savePrices")}
              </button>
              <label className="branch-tax-input">
                <span>
                  {t("admin.module3.overrides.taxRate")}
                  <em>{t(`admin.module3.overrides.taxSource.${product.taxSource}`)}</em>
                </span>
                <select
                  value={taxDrafts[product.id] ?? product.effectiveTaxRateId}
                  onChange={(event) => onTaxDraftChange(product.id, event.target.value)}
                >
                  {taxRates.map((rate) => (
                    <option key={rate.id} value={rate.id}>
                      {rate.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button-secondary"
                type="button"
                onClick={() => void onSaveTax(product)}
              >
                {t("admin.module3.overrides.saveTax")}
              </button>
              <fieldset className="branch-route-group">
                <legend>
                  {t("admin.module3.overrides.printStations")}
                  <em>{t(`admin.module3.overrides.routeSource.${product.printRouteSource}`)}</em>
                </legend>
                {printStations.map((station) => {
                  const selectedStations = printDrafts[product.id] ?? product.printStations;
                  return (
                    <label className="toggle-row compact-toggle" key={`${product.id}-${station}`}>
                      <input
                        checked={selectedStations.includes(station)}
                        type="checkbox"
                        onChange={() =>
                          onPrintDraftChange(product.id, toggleStation(selectedStations, station))
                        }
                      />
                      <span>{t(`admin.module3.overrides.station.${station}`)}</span>
                    </label>
                  );
                })}
              </fieldset>
              <button
                className="button-secondary"
                type="button"
                onClick={() => void onSavePrintRoutes(product)}
              >
                {t("admin.module3.overrides.saveRoutes")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function toggleStation(stations: string[], station: string): string[] {
  return stations.includes(station)
    ? stations.filter((value) => value !== station)
    : [...stations, station].sort();
}
