import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { paths } from "@quickarte/shared-types";
import { apiClient, readResponseProblem } from "../auth/api";

type SetupResponse =
  paths["/v1/businesses/me/setup"]["get"]["responses"][200]["content"]["application/json"];
type UpdateSetupBody =
  paths["/v1/businesses/me/setup"]["patch"]["requestBody"]["content"]["application/json"];

type ProfileForm = {
  name: string;
  type: "restaurant" | "cafe" | "autre";
  currency: string;
  secondaryCurrency: string;
  timezone: string;
  locale: string;
  logo: string;
  legalName: string;
  iceNumber: string;
  rcNumber: string;
  ifNumber: string;
  patenteNumber: string;
  cnssNumber: string;
};

const initialForm: ProfileForm = {
  name: "",
  type: "cafe",
  currency: "MAD",
  secondaryCurrency: "",
  timezone: "Africa/Casablanca",
  locale: "fr-MA",
  logo: "",
  legalName: "",
  iceNumber: "",
  rcNumber: "",
  ifNumber: "",
  patenteNumber: "",
  cnssNumber: "",
};

export function RestaurantProfilePage() {
  const { t } = useTranslation();
  const [form, setForm] = useState<ProfileForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void load();

    async function load() {
      setLoading(true);
      const response = await apiClient().GET("/v1/businesses/me/setup");
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (response.error || !response.data) {
        setError(t("admin.module2.profile.loadError"));
        return;
      }
      const setup: SetupResponse = response.data;
      setForm({
        name: setup.business.name,
        type: setup.business.type,
        currency: setup.business.currency,
        secondaryCurrency: setup.business.secondaryCurrency ?? "",
        timezone: setup.business.timezone,
        locale: setup.business.locale,
        logo: setup.business.logo ?? "",
        legalName: setup.legalProfile?.legalName ?? "",
        iceNumber: setup.legalProfile?.iceNumber ?? "",
        rcNumber: setup.legalProfile?.rcNumber ?? "",
        ifNumber: setup.legalProfile?.ifNumber ?? "",
        patenteNumber: setup.legalProfile?.patenteNumber ?? "",
        cnssNumber: setup.legalProfile?.cnssNumber ?? "",
      });
    }

    return () => {
      cancelled = true;
    };
  }, [t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const body: UpdateSetupBody = {
      name: form.name,
      type: form.type,
      currency: form.currency,
      secondaryCurrency: emptyToNull(form.secondaryCurrency),
      timezone: form.timezone,
      locale: form.locale,
      logo: emptyToNull(form.logo),
      legalProfile: {
        legalName: form.legalName,
        iceNumber: emptyToNull(form.iceNumber),
        rcNumber: emptyToNull(form.rcNumber),
        ifNumber: emptyToNull(form.ifNumber),
        patenteNumber: emptyToNull(form.patenteNumber),
        cnssNumber: emptyToNull(form.cnssNumber),
      },
    };
    const response = await apiClient().PATCH("/v1/businesses/me/setup", { body });

    setSaving(false);
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module2.profile.saveError"));
      return;
    }
    setMessage(t("admin.module2.profile.saved"));
  }

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  if (loading) {
    return <p>{t("admin.dashboard.loading")}</p>;
  }

  return (
    <section className="settings-page">
      <div className="page-heading">
        <p className="eyebrow">{t("admin.module2.eyebrow")}</p>
        <h1>{t("admin.module2.profile.title")}</h1>
      </div>
      <form className="settings-form" onSubmit={(event) => void submit(event)}>
        <fieldset>
          <legend>{t("admin.module2.profile.businessSection")}</legend>
          <label>
            <span>{t("admin.module2.profile.name")}</span>
            <input
              onChange={(event) => update("name", event.target.value)}
              required
              value={form.name}
            />
          </label>
          <label>
            <span>{t("admin.module2.profile.type")}</span>
            <select
              onChange={(event) =>
                update("type", event.target.value as ProfileForm["type"])
              }
              value={form.type}
            >
              <option value="restaurant">{t("businessTypes.restaurant")}</option>
              <option value="cafe">{t("businessTypes.cafe")}</option>
              <option value="autre">{t("businessTypes.autre")}</option>
            </select>
          </label>
          <label>
            <span>{t("admin.module2.profile.currency")}</span>
            <input
              onChange={(event) => update("currency", event.target.value)}
              required
              value={form.currency}
            />
          </label>
          <label>
            <span>{t("admin.module2.profile.secondaryCurrency")}</span>
            <input
              onChange={(event) => update("secondaryCurrency", event.target.value)}
              value={form.secondaryCurrency}
            />
          </label>
          <label>
            <span>{t("admin.module2.profile.timezone")}</span>
            <input
              onChange={(event) => update("timezone", event.target.value)}
              required
              value={form.timezone}
            />
          </label>
          <label>
            <span>{t("admin.module2.profile.locale")}</span>
            <input
              onChange={(event) => update("locale", event.target.value)}
              required
              value={form.locale}
            />
          </label>
          <label>
            <span>{t("admin.module2.profile.logo")}</span>
            <input
              onChange={(event) => update("logo", event.target.value)}
              value={form.logo}
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>{t("admin.module2.profile.legalSection")}</legend>
          <label>
            <span>{t("admin.module2.profile.legalName")}</span>
            <input
              onChange={(event) => update("legalName", event.target.value)}
              required
              value={form.legalName}
            />
          </label>
          <label>
            <span>{t("admin.module2.profile.iceNumber")}</span>
            <input
              onChange={(event) => update("iceNumber", event.target.value)}
              value={form.iceNumber}
            />
          </label>
          <label>
            <span>{t("admin.module2.profile.rcNumber")}</span>
            <input
              onChange={(event) => update("rcNumber", event.target.value)}
              value={form.rcNumber}
            />
          </label>
          <label>
            <span>{t("admin.module2.profile.ifNumber")}</span>
            <input
              onChange={(event) => update("ifNumber", event.target.value)}
              value={form.ifNumber}
            />
          </label>
          <label>
            <span>{t("admin.module2.profile.patenteNumber")}</span>
            <input
              onChange={(event) => update("patenteNumber", event.target.value)}
              value={form.patenteNumber}
            />
          </label>
          <label>
            <span>{t("admin.module2.profile.cnssNumber")}</span>
            <input
              onChange={(event) => update("cnssNumber", event.target.value)}
              value={form.cnssNumber}
            />
          </label>
        </fieldset>

        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}
        <button disabled={saving} type="submit">
          {saving ? t("admin.module2.saving") : t("form.actions.save")}
        </button>
      </form>
    </section>
  );
}

function emptyToNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}
