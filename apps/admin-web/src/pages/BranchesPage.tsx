import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { paths } from "@quickarte/shared-types";
import { apiClient, readResponseProblem } from "../auth/api";

type BranchListResponse =
  paths["/v1/branches"]["get"]["responses"][200]["content"]["application/json"];
type Branch = BranchListResponse["branches"][number];
type CreateBranchBody =
  paths["/v1/branches"]["post"]["requestBody"]["content"]["application/json"];

type BranchForm = {
  id: string | null;
  name: string;
  slug: string;
  city: string;
  addressLine1: string;
  phone: string;
  seatingCapacity: string;
};

const emptyForm: BranchForm = {
  id: null,
  name: "",
  slug: "",
  city: "",
  addressLine1: "",
  phone: "",
  seatingCapacity: "",
};

export function BranchesPage() {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState<BranchForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    const response = await apiClient().GET("/v1/branches");
    setLoading(false);
    if (response.error || !response.data) {
      setError(t("admin.module2.branches.loadError"));
      return;
    }
    setBranches(response.data.branches);
  }, [t]);

  useEffect(() => {
    void Promise.resolve().then(loadBranches);
  }, [loadBranches]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const body: CreateBranchBody = {
      name: form.name,
      slug: form.slug,
      countryCode: "MA",
      city: emptyToNull(form.city),
      addressLine1: emptyToNull(form.addressLine1),
      phone: emptyToNull(form.phone),
      seatingCapacity: form.seatingCapacity ? Number(form.seatingCapacity) : null,
    };

    const response = form.id
      ? await apiClient().PATCH("/v1/branches/{branchId}", {
          params: { path: { branchId: form.id } },
          body,
        })
      : await apiClient().POST("/v1/branches", { body });

    setSaving(false);
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module2.branches.saveError"));
      return;
    }
    setForm(emptyForm);
    setMessage(t("admin.module2.branches.saved"));
    await loadBranches();
  }

  async function setDefault(branchId: string) {
    const response = await apiClient().POST("/v1/branches/{branchId}/set-default", {
      params: { path: { branchId } },
    });
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module2.branches.saveError"));
      return;
    }
    await loadBranches();
  }

  async function deactivate(branchId: string) {
    if (!window.confirm(t("admin.module2.branches.deactivateConfirm"))) {
      return;
    }
    const response = await apiClient().DELETE("/v1/branches/{branchId}", {
      params: { path: { branchId } },
    });
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module2.branches.saveError"));
      return;
    }
    await loadBranches();
  }

  function edit(branch: Branch) {
    setForm({
      id: branch.id,
      name: branch.name,
      slug: branch.slug,
      city: branch.city ?? "",
      addressLine1: branch.addressLine1 ?? "",
      phone: branch.phone ?? "",
      seatingCapacity: branch.seatingCapacity?.toString() ?? "",
    });
  }

  function update<K extends keyof BranchForm>(key: K, value: BranchForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="settings-page">
      <div className="page-heading">
        <p className="eyebrow">{t("admin.module2.eyebrow")}</p>
        <h1>{t("admin.module2.branches.title")}</h1>
      </div>

      {loading ? <p>{t("admin.dashboard.loading")}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

      <div className="settings-layout">
        <div className="data-panel">
          <h2>{t("admin.module2.branches.listTitle")}</h2>
          <div className="branch-list">
            {branches.map((branch) => (
              <article className="branch-row" key={branch.id}>
                <div>
                  <h3>{branch.name}</h3>
                  <p>{branch.slug}</p>
                  {branch.city ? <p>{branch.city}</p> : null}
                </div>
                <div className="row-actions">
                  {branch.isDefault ? (
                    <span className="status-pill">{t("admin.module2.branches.default")}</span>
                  ) : (
                    <button type="button" onClick={() => void setDefault(branch.id)}>
                      {t("admin.module2.branches.setDefault")}
                    </button>
                  )}
                  <button type="button" onClick={() => edit(branch)}>
                    {t("admin.module2.branches.edit")}
                  </button>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => void deactivate(branch.id)}
                  >
                    {t("admin.module2.branches.deactivate")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <form className="settings-form compact" onSubmit={(event) => void submit(event)}>
          <h2>
            {form.id
              ? t("admin.module2.branches.editTitle")
              : t("admin.module2.branches.createTitle")}
          </h2>
          <label>
            <span>{t("form.fields.name")}</span>
            <input
              onChange={(event) => update("name", event.target.value)}
              required
              value={form.name}
            />
          </label>
          <label>
            <span>{t("admin.module2.branches.slug")}</span>
            <input
              onChange={(event) => update("slug", event.target.value)}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
              value={form.slug}
            />
          </label>
          <label>
            <span>{t("admin.module2.branches.city")}</span>
            <input
              onChange={(event) => update("city", event.target.value)}
              value={form.city}
            />
          </label>
          <label>
            <span>{t("admin.module2.branches.address")}</span>
            <input
              onChange={(event) => update("addressLine1", event.target.value)}
              value={form.addressLine1}
            />
          </label>
          <label>
            <span>{t("admin.module2.branches.phone")}</span>
            <input
              onChange={(event) => update("phone", event.target.value)}
              value={form.phone}
            />
          </label>
          <label>
            <span>{t("admin.module2.branches.seatingCapacity")}</span>
            <input
              min="0"
              onChange={(event) => update("seatingCapacity", event.target.value)}
              type="number"
              value={form.seatingCapacity}
            />
          </label>
          <div className="form-actions">
            <button disabled={saving} type="submit">
              {form.id
                ? t("admin.module2.branches.save")
                : t("admin.module2.branches.create")}
            </button>
            {form.id ? (
              <button
                className="button-secondary"
                type="button"
                onClick={() => setForm(emptyForm)}
              >
                {t("form.actions.cancel")}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}

function emptyToNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}
