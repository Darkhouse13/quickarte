import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { paths } from "@quickarte/shared-types";
import { apiClient, readResponseProblem } from "../auth/api";

type BranchListResponse =
  paths["/v1/branches"]["get"]["responses"][200]["content"]["application/json"];
type Branch = BranchListResponse["branches"][number];
type TaxRatesResponse =
  paths["/v1/tax-rates"]["get"]["responses"][200]["content"]["application/json"];
type TaxRate = TaxRatesResponse["rates"][number];
type TaxConfigResponse =
  paths["/v1/branches/{branchId}/tax-config"]["get"]["responses"][200]["content"]["application/json"];
type TaxConfigBody =
  paths["/v1/branches/{branchId}/tax-config"]["put"]["requestBody"]["content"]["application/json"];

const defaultConfig: TaxConfigResponse = {
  branchId: "",
  defaultTaxRateId: "ma_tva_10",
  taxApplicationLevel: "category",
  priceDisplayMode: "ttc",
  serviceChargeEnabled: false,
  serviceChargeRate: null,
  serviceChargeLabel: null,
  isDefaultPresentation: true,
};

export function TaxConfigurationPage() {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [config, setConfig] = useState<TaxConfigResponse>(defaultConfig);
  const [serviceChargeRateInput, setServiceChargeRateInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadBranchesAndRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [branchResponse, ratesResponse] = await Promise.all([
      apiClient().GET("/v1/branches"),
      apiClient().GET("/v1/tax-rates"),
    ]);
    setLoading(false);

    if (branchResponse.error || !branchResponse.data) {
      setError(t("admin.module2.branches.loadError"));
      return;
    }
    if (ratesResponse.error || !ratesResponse.data) {
      setError(t("admin.module2.tax.loadError"));
      return;
    }

    setBranches(branchResponse.data.branches);
    setRates(ratesResponse.data.rates);
    setBranchId((current) => current || branchResponse.data.branches[0]?.id || "");
  }, [t]);

  const loadTaxConfig = useCallback(
    async (nextBranchId: string) => {
      if (!nextBranchId) {
        setConfig(defaultConfig);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const response = await apiClient().GET("/v1/branches/{branchId}/tax-config", {
        params: { path: { branchId: nextBranchId } },
      });
      setLoading(false);
      if (response.error || !response.data) {
        setError(t("admin.module2.tax.loadError"));
        return;
      }
      setConfig(response.data);
      setServiceChargeRateInput(
        response.data.serviceChargeRate === null ? "" : String(response.data.serviceChargeRate),
      );
    },
    [t],
  );

  useEffect(() => {
    void Promise.resolve().then(loadBranchesAndRates);
  }, [loadBranchesAndRates]);

  useEffect(() => {
    void Promise.resolve().then(() => loadTaxConfig(branchId));
  }, [branchId, loadTaxConfig]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const serviceChargeRate =
      config.serviceChargeEnabled && serviceChargeRateInput.trim()
        ? Number(serviceChargeRateInput)
        : null;
    const body: TaxConfigBody = {
      defaultTaxRateId: config.defaultTaxRateId,
      taxApplicationLevel: config.taxApplicationLevel,
      priceDisplayMode: config.priceDisplayMode,
      serviceChargeEnabled: config.serviceChargeEnabled,
      serviceChargeRate,
      serviceChargeLabel: config.serviceChargeLabel?.trim() || null,
    };

    const response = await apiClient().PUT("/v1/branches/{branchId}/tax-config", {
      params: { path: { branchId } },
      body,
    });

    setSaving(false);
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module2.tax.saveError"));
      return;
    }
    setConfig(response.data);
    setServiceChargeRateInput(
      response.data.serviceChargeRate === null ? "" : String(response.data.serviceChargeRate),
    );
    setMessage(t("admin.module2.tax.saved"));
  }

  function patchConfig(patch: Partial<TaxConfigResponse>) {
    setConfig((current) => ({ ...current, ...patch }));
  }

  return (
    <section className="settings-page">
      <div className="page-heading">
        <p className="eyebrow">{t("admin.module2.eyebrow")}</p>
        <h1>{t("admin.module2.tax.title")}</h1>
      </div>

      {loading ? <p>{t("admin.dashboard.loading")}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

      <form className="settings-form" onSubmit={(event) => void submit(event)}>
        <div className="form-toolbar">
          <label>
            <span>{t("admin.module2.branches.title")}</span>
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          {config.isDefaultPresentation ? (
            <span className="status-pill">{t("admin.module2.tax.defaultPresentation")}</span>
          ) : null}
        </div>

        <fieldset>
          <legend>{t("admin.module2.tax.rateSection")}</legend>
          <label>
            <span>{t("admin.module2.tax.defaultRate")}</span>
            <select
              value={config.defaultTaxRateId}
              onChange={(event) => patchConfig({ defaultTaxRateId: event.target.value })}
            >
              {rates.map((rate) => (
                <option key={rate.id} value={rate.id}>
                  {rate.label} ({rate.rate}%)
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("admin.module2.tax.applicationLevel")}</span>
            <select
              value={config.taxApplicationLevel}
              onChange={(event) =>
                patchConfig({
                  taxApplicationLevel: event.target.value as TaxConfigResponse["taxApplicationLevel"],
                })
              }
            >
              <option value="category">{t("admin.module2.tax.category")}</option>
              <option value="item">{t("admin.module2.tax.item")}</option>
            </select>
          </label>
          <label>
            <span>{t("admin.module2.tax.priceDisplayMode")}</span>
            <select
              value={config.priceDisplayMode}
              onChange={(event) =>
                patchConfig({
                  priceDisplayMode: event.target.value as TaxConfigResponse["priceDisplayMode"],
                })
              }
            >
              <option value="ttc">{t("admin.module2.tax.ttc")}</option>
              <option value="ht_plus_tva">{t("admin.module2.tax.htPlusTva")}</option>
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>{t("admin.module2.tax.serviceChargeSection")}</legend>
          <label className="toggle-row">
            <input
              checked={config.serviceChargeEnabled}
              onChange={(event) =>
                patchConfig({ serviceChargeEnabled: event.target.checked })
              }
              type="checkbox"
            />
            <span>{t("admin.module2.tax.serviceChargeEnabled")}</span>
          </label>
          <label>
            <span>{t("admin.module2.tax.serviceChargeRate")}</span>
            <input
              disabled={!config.serviceChargeEnabled}
              max={100}
              min={0}
              onChange={(event) => setServiceChargeRateInput(event.target.value)}
              step="0.01"
              type="number"
              value={serviceChargeRateInput}
            />
          </label>
          <label>
            <span>{t("admin.module2.tax.serviceChargeLabel")}</span>
            <input
              disabled={!config.serviceChargeEnabled}
              onChange={(event) => patchConfig({ serviceChargeLabel: event.target.value })}
              value={config.serviceChargeLabel ?? ""}
            />
          </label>
        </fieldset>

        <div className="form-actions">
          <button disabled={saving || !branchId} type="submit">
            {saving ? t("admin.module2.saving") : t("admin.module2.tax.save")}
          </button>
        </div>
      </form>
    </section>
  );
}
