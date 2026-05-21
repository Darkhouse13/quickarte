import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { paths } from "@quickarte/shared-types";
import { apiClient, readResponseProblem } from "../auth/api";

type BranchListResponse =
  paths["/v1/branches"]["get"]["responses"][200]["content"]["application/json"];
type Branch = BranchListResponse["branches"][number];
type ReceiptSettingsResponse =
  paths["/v1/branches/{branchId}/receipt-settings"]["get"]["responses"][200]["content"]["application/json"];
type ReceiptSettingsBody =
  paths["/v1/branches/{branchId}/receipt-settings"]["put"]["requestBody"]["content"]["application/json"];
type ReceiptLine = ReceiptSettingsBody["headerLines"][number];

const defaultSettings: ReceiptSettingsResponse = {
  branchId: "",
  logoUrl: null,
  headerLines: [],
  footerLines: [],
  showItemCodes: false,
  showTaxBreakdown: true,
  showServerName: true,
  showTableNumber: true,
  bilingualMode: "fr_only",
  paperWidth: "80mm",
  qrCodeMode: "none",
  qrCodeUrl: null,
  isDefaultPresentation: true,
};

export function ReceiptSettingsPage() {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [settings, setSettings] = useState<ReceiptSettingsResponse>(defaultSettings);
  const [previewText, setPreviewText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await apiClient().GET("/v1/branches");
    setLoading(false);
    if (response.error || !response.data) {
      setError(t("admin.module2.branches.loadError"));
      return;
    }
    setBranches(response.data.branches);
    setBranchId((current) => current || response.data.branches[0]?.id || "");
  }, [t]);

  const loadSettings = useCallback(
    async (nextBranchId: string) => {
      if (!nextBranchId) {
        setSettings(defaultSettings);
        setPreviewText("");
        return;
      }
      setLoading(true);
      setError(null);
      const response = await apiClient().GET("/v1/branches/{branchId}/receipt-settings", {
        params: { path: { branchId: nextBranchId } },
      });
      setLoading(false);
      if (response.error || !response.data) {
        setError(t("admin.module2.receipts.loadError"));
        return;
      }
      setSettings(response.data);
      setPreviewText("");
    },
    [t],
  );

  useEffect(() => {
    void Promise.resolve().then(loadBranches);
  }, [loadBranches]);

  useEffect(() => {
    void Promise.resolve().then(() => loadSettings(branchId));
  }, [branchId, loadSettings]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save();
  }

  async function save() {
    if (!branchId) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    const response = await apiClient().PUT("/v1/branches/{branchId}/receipt-settings", {
      params: { path: { branchId } },
      body: toBody(settings),
    });
    setSaving(false);
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module2.receipts.saveError"));
      return;
    }
    setSettings(response.data);
    setMessage(t("admin.module2.receipts.saved"));
  }

  async function preview() {
    if (!branchId) {
      return;
    }
    setPreviewing(true);
    setError(null);
    const response = await apiClient().POST("/v1/branches/{branchId}/receipt-settings/preview", {
      params: { path: { branchId } },
      body: toBody(settings),
    });
    setPreviewing(false);
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module2.receipts.previewError"));
      return;
    }
    setPreviewText(response.data.renderedText);
  }

  function patchSettings(patch: Partial<ReceiptSettingsResponse>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function updateLine(kind: "headerLines" | "footerLines", index: number, patch: Partial<ReceiptLine>) {
    setSettings((current) => ({
      ...current,
      [kind]: current[kind].map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  }

  function addLine(kind: "headerLines" | "footerLines") {
    setSettings((current) => ({
      ...current,
      [kind]: [...current[kind], { locale: "fr", text: "" }],
    }));
  }

  function removeLine(kind: "headerLines" | "footerLines", index: number) {
    setSettings((current) => ({
      ...current,
      [kind]: current[kind].filter((_, lineIndex) => lineIndex !== index),
    }));
  }

  return (
    <section className="settings-page">
      <div className="page-heading">
        <p className="eyebrow">{t("admin.module2.eyebrow")}</p>
        <h1>{t("admin.module2.receipts.title")}</h1>
      </div>

      {loading ? <p>{t("admin.dashboard.loading")}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

      <div className="settings-layout">
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
            {settings.isDefaultPresentation ? (
              <span className="status-pill">{t("admin.module2.receipts.defaultPresentation")}</span>
            ) : null}
          </div>

          <fieldset>
            <legend>{t("admin.module2.receipts.layoutSection")}</legend>
            <label>
              <span>{t("admin.module2.receipts.logoUrl")}</span>
              <input
                onChange={(event) => patchSettings({ logoUrl: event.target.value })}
                value={settings.logoUrl ?? ""}
              />
            </label>
            <label>
              <span>{t("admin.module2.receipts.bilingualMode")}</span>
              <select
                value={settings.bilingualMode}
                onChange={(event) =>
                  patchSettings({
                    bilingualMode: event.target.value as ReceiptSettingsResponse["bilingualMode"],
                  })
                }
              >
                <option value="fr_only">{t("admin.module2.receipts.frOnly")}</option>
                <option value="ar_only">{t("admin.module2.receipts.arOnly")}</option>
                <option value="stacked">{t("admin.module2.receipts.stacked")}</option>
                <option value="side_by_side">{t("admin.module2.receipts.sideBySide")}</option>
              </select>
            </label>
            <label>
              <span>{t("admin.module2.receipts.paperWidth")}</span>
              <select
                value={settings.paperWidth}
                onChange={(event) =>
                  patchSettings({
                    paperWidth: event.target.value as ReceiptSettingsResponse["paperWidth"],
                  })
                }
              >
                <option value="80mm">80mm</option>
                <option value="58mm">58mm</option>
              </select>
            </label>
          </fieldset>

          <fieldset>
            <legend>{t("admin.module2.receipts.togglesSection")}</legend>
            <Toggle
              checked={settings.showItemCodes}
              label={t("admin.module2.receipts.showItemCodes")}
              onChange={(checked) => patchSettings({ showItemCodes: checked })}
            />
            <Toggle
              checked={settings.showTaxBreakdown}
              label={t("admin.module2.receipts.showTaxBreakdown")}
              onChange={(checked) => patchSettings({ showTaxBreakdown: checked })}
            />
            <Toggle
              checked={settings.showServerName}
              label={t("admin.module2.receipts.showServerName")}
              onChange={(checked) => patchSettings({ showServerName: checked })}
            />
            <Toggle
              checked={settings.showTableNumber}
              label={t("admin.module2.receipts.showTableNumber")}
              onChange={(checked) => patchSettings({ showTableNumber: checked })}
            />
          </fieldset>

          <LineEditor
            addLabel={t("admin.module2.receipts.addHeaderLine")}
            lines={settings.headerLines}
            onAdd={() => addLine("headerLines")}
            onRemove={(index) => removeLine("headerLines", index)}
            onUpdate={(index, patch) => updateLine("headerLines", index, patch)}
            title={t("admin.module2.receipts.headerLines")}
          />
          <LineEditor
            addLabel={t("admin.module2.receipts.addFooterLine")}
            lines={settings.footerLines}
            onAdd={() => addLine("footerLines")}
            onRemove={(index) => removeLine("footerLines", index)}
            onUpdate={(index, patch) => updateLine("footerLines", index, patch)}
            title={t("admin.module2.receipts.footerLines")}
          />

          <fieldset>
            <legend>{t("admin.module2.receipts.qrSection")}</legend>
            <label>
              <span>{t("admin.module2.receipts.qrCodeMode")}</span>
              <select
                value={settings.qrCodeMode}
                onChange={(event) =>
                  patchSettings({
                    qrCodeMode: event.target.value as ReceiptSettingsResponse["qrCodeMode"],
                  })
                }
              >
                <option value="none">{t("admin.module2.receipts.qrNone")}</option>
                <option value="fidelity_signup">{t("admin.module2.receipts.qrFidelity")}</option>
                <option value="social_link">{t("admin.module2.receipts.qrSocial")}</option>
                <option value="custom_url">{t("admin.module2.receipts.qrCustom")}</option>
              </select>
            </label>
            <label>
              <span>{t("admin.module2.receipts.qrCodeUrl")}</span>
              <input
                disabled={settings.qrCodeMode !== "custom_url"}
                onChange={(event) => patchSettings({ qrCodeUrl: event.target.value })}
                value={settings.qrCodeUrl ?? ""}
              />
            </label>
          </fieldset>

          <div className="form-actions">
            <button disabled={previewing || !branchId} onClick={() => void preview()} type="button">
              {previewing ? t("admin.module2.receipts.previewing") : t("admin.module2.receipts.preview")}
            </button>
            <button disabled={saving || !branchId} type="submit">
              {saving ? t("admin.module2.saving") : t("admin.module2.receipts.save")}
            </button>
          </div>
        </form>

        <section className="data-panel receipt-preview-panel">
          <h2>{t("admin.module2.receipts.previewTitle")}</h2>
          <pre className={`receipt-preview receipt-preview-${settings.paperWidth}`}>
            {previewText || t("admin.module2.receipts.previewEmpty")}
          </pre>
        </section>
      </div>
    </section>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

function LineEditor({
  addLabel,
  lines,
  onAdd,
  onRemove,
  onUpdate,
  title,
}: {
  addLabel: string;
  lines: ReceiptLine[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<ReceiptLine>) => void;
  title: string;
}) {
  const { t } = useTranslation();

  return (
    <section className="data-panel">
      <div className="section-heading-row">
        <h2>{title}</h2>
        <button onClick={onAdd} type="button">
          {addLabel}
        </button>
      </div>
      <div className="settings-list">
        {lines.map((line, index) => (
          <div className="method-row" key={`${line.locale}-${index}`}>
            <select
              aria-label={t("admin.module2.receipts.lineLocale")}
              onChange={(event) => onUpdate(index, { locale: event.target.value as ReceiptLine["locale"] })}
              value={line.locale}
            >
              <option value="fr">FR</option>
              <option value="ar">AR</option>
              <option value="darija">Darija</option>
            </select>
            <input
              aria-label={t("admin.module2.receipts.lineText")}
              onChange={(event) => onUpdate(index, { text: event.target.value })}
              value={line.text}
            />
            <button onClick={() => onRemove(index)} type="button">
              {t("admin.module2.receipts.removeLine")}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function toBody(settings: ReceiptSettingsResponse): ReceiptSettingsBody {
  return {
    logoUrl: emptyToNull(settings.logoUrl),
    headerLines: settings.headerLines,
    footerLines: settings.footerLines,
    showItemCodes: settings.showItemCodes,
    showTaxBreakdown: settings.showTaxBreakdown,
    showServerName: settings.showServerName,
    showTableNumber: settings.showTableNumber,
    bilingualMode: settings.bilingualMode,
    paperWidth: settings.paperWidth,
    qrCodeMode: settings.qrCodeMode,
    qrCodeUrl: settings.qrCodeMode === "custom_url" ? emptyToNull(settings.qrCodeUrl) : null,
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
