import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { paths } from "@quickarte/shared-types";
import { apiClient, readResponseProblem } from "../auth/api";

type BranchListResponse =
  paths["/v1/branches"]["get"]["responses"][200]["content"]["application/json"];
type Branch = BranchListResponse["branches"][number];
type DefinitionsResponse =
  paths["/v1/payment-method-definitions"]["get"]["responses"][200]["content"]["application/json"];
type Definition = DefinitionsResponse["definitions"][number];
type MethodsResponse =
  paths["/v1/branches/{branchId}/payment-methods"]["get"]["responses"][200]["content"]["application/json"];
type PaymentMethodsBody =
  paths["/v1/branches/{branchId}/payment-methods"]["put"]["requestBody"]["content"]["application/json"];
type MethodInput = PaymentMethodsBody["methods"][number];

type MethodRow = MethodInput & {
  key: string;
  label: string;
  category: string;
};

export function PaymentMethodsPage() {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [rows, setRows] = useState<MethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadBranchesAndDefinitions = useCallback(async () => {
    const [branchResponse, definitionResponse] = await Promise.all([
      apiClient().GET("/v1/branches"),
      apiClient().GET("/v1/payment-method-definitions"),
    ]);
    if (branchResponse.error || !branchResponse.data) {
      setError(t("admin.module2.branches.loadError"));
      return;
    }
    if (definitionResponse.error || !definitionResponse.data) {
      setError(t("admin.module2.paymentMethods.loadError"));
      return;
    }
    setBranches(branchResponse.data.branches);
    setDefinitions(definitionResponse.data.definitions);
    setBranchId((current) => current || branchResponse.data.branches[0]?.id || "");
  }, [t]);

  const loadMethods = useCallback(
    async (nextBranchId: string, currentDefinitions: Definition[]) => {
      if (!nextBranchId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const response = await apiClient().GET("/v1/branches/{branchId}/payment-methods", {
        params: { path: { branchId: nextBranchId } },
      });
      setLoading(false);
      if (response.error || !response.data) {
        setError(t("admin.module2.paymentMethods.loadError"));
        return;
      }
      setRows(toRows(response.data, currentDefinitions));
    },
    [t],
  );

  useEffect(() => {
    void Promise.resolve().then(loadBranchesAndDefinitions);
  }, [loadBranchesAndDefinitions]);

  useEffect(() => {
    void Promise.resolve().then(() => loadMethods(branchId, definitions));
  }, [branchId, definitions, loadMethods]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);

    const body: PaymentMethodsBody = {
      methods: rows
        .filter((row) => row.enabled || row.methodCode || row.customName?.trim())
        .map((row, index) => ({
          methodCode: row.methodCode ?? null,
          customName: row.methodCode ? null : emptyToNull(row.customName ?? ""),
          enabled: row.enabled,
          cashDrawerAutoOpen: row.cashDrawerAutoOpen,
          sortOrder: index,
          metadata: row.metadata ?? null,
        })),
    };
    const response = await apiClient().PUT("/v1/branches/{branchId}/payment-methods", {
      params: { path: { branchId } },
      body,
    });

    setSaving(false);
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module2.paymentMethods.saveError"));
      return;
    }
    setRows(toRows(response.data, definitions));
    setMessage(t("admin.module2.paymentMethods.saved"));
  }

  function updateRow(index: number, patch: Partial<MethodRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function moveRow(index: number, direction: -1 | 1) {
    setRows((current) => {
      const next = [...current];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) {
        return current;
      }
      const currentRow = next[index];
      const targetRow = next[targetIndex];
      if (!currentRow || !targetRow) {
        return current;
      }
      next[index] = targetRow;
      next[targetIndex] = currentRow;
      return next;
    });
  }

  function addCustomMethod() {
    setRows((current) => [
      ...current,
      {
        key: `custom-${Date.now()}`,
        methodCode: null,
        customName: "",
        label: t("admin.module2.paymentMethods.customMethod"),
        category: "custom",
        enabled: true,
        cashDrawerAutoOpen: false,
        sortOrder: current.length,
        metadata: null,
      },
    ]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <section className="settings-page">
      <div className="page-heading">
        <p className="eyebrow">{t("admin.module2.eyebrow")}</p>
        <h1>{t("admin.module2.paymentMethods.title")}</h1>
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
          <button type="button" onClick={addCustomMethod}>
            {t("admin.module2.paymentMethods.addCustom")}
          </button>
        </div>

        <section className="data-panel">
          <h2>{t("admin.module2.paymentMethods.configured")}</h2>
          <div className="settings-list">
            {rows.map((row, index) => (
              <article className="method-row" key={row.key}>
                <label className="toggle-row">
                  <input
                    checked={row.enabled}
                    onChange={(event) => updateRow(index, { enabled: event.target.checked })}
                    type="checkbox"
                  />
                  <span>{row.methodCode ? row.label : t("admin.module2.paymentMethods.enabled")}</span>
                </label>
                {row.methodCode ? (
                  <span className="status-pill">{row.category}</span>
                ) : (
                  <input
                    aria-label={t("admin.module2.paymentMethods.customName")}
                    onChange={(event) =>
                      updateRow(index, {
                        customName: event.target.value,
                        label: event.target.value || t("admin.module2.paymentMethods.customMethod"),
                      })
                    }
                    placeholder={t("admin.module2.paymentMethods.customName")}
                    required
                    value={row.customName ?? ""}
                  />
                )}
                <label className="toggle-row">
                  <input
                    checked={row.cashDrawerAutoOpen}
                    onChange={(event) =>
                      updateRow(index, { cashDrawerAutoOpen: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <span>{t("admin.module2.paymentMethods.cashDrawer")}</span>
                </label>
                <div className="row-actions">
                  <button className="button-secondary" type="button" onClick={() => moveRow(index, -1)}>
                    {t("admin.module2.paymentMethods.moveUp")}
                  </button>
                  <button className="button-secondary" type="button" onClick={() => moveRow(index, 1)}>
                    {t("admin.module2.paymentMethods.moveDown")}
                  </button>
                  {!row.methodCode ? (
                    <button className="button-secondary" type="button" onClick={() => removeRow(index)}>
                      {t("form.actions.cancel")}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <button disabled={saving || !branchId} type="submit">
          {saving ? t("admin.module2.saving") : t("form.actions.save")}
        </button>
      </form>
    </section>
  );
}

function toRows(response: MethodsResponse, definitions: Definition[]): MethodRow[] {
  if (response.methods.length > 0) {
    return response.methods.map((method) => ({
      key: method.id,
      methodCode: method.methodCode ?? null,
      customName: method.customName ?? null,
      label: method.label,
      category: method.category,
      enabled: method.enabled,
      cashDrawerAutoOpen: method.cashDrawerAutoOpen,
      sortOrder: method.sortOrder,
      metadata: method.metadata ?? null,
    }));
  }

  return definitions.map((definition, index) => ({
    key: definition.code,
    methodCode: definition.code,
    customName: null,
    label: definition.label,
    category: definition.category,
    enabled: definition.code === "cash",
    cashDrawerAutoOpen: definition.code === "cash",
    sortOrder: index,
    metadata: null,
  }));
}

function emptyToNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}
