import { ChangeEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { paths } from "@quickarte/shared-types";
import { apiBaseUrl, apiClient, readResponseProblem } from "../auth/api";
import { useAuthStore } from "../auth/store";

type ImportUploadResponse =
  paths["/v1/menu/import"]["post"]["responses"][201]["content"]["application/json"];
type ImportJobResponse =
  paths["/v1/menu/import/{jobId}"]["get"]["responses"][200]["content"]["application/json"];
type ImportPreview = ImportUploadResponse["preview"];
type ImportPreviewRow = ImportPreview["rows"][number];
type ImportCommitResponse =
  paths["/v1/menu/import/{jobId}/commit"]["post"]["responses"][201]["content"]["application/json"];

type ImportProblem = {
  detail?: string;
  preview?: ImportPreview;
};

type MenuImportPanelProps = {
  id?: string;
  onCommitted: () => Promise<void>;
};

export function MenuImportPanel({ id, onCommitted }: MenuImportPanelProps) {
  const { t } = useTranslation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [job, setJob] = useState<ImportJobResponse | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadTemplate() {
    setError(null);
    const response = await fetch(`${apiBaseUrl()}/menu/import/template`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!response.ok) {
      setError(t("admin.module3.import.templateError"));
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mizan-menu-import-template.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setCommitResult(null);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(`${apiBaseUrl()}/menu/import`, {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: formData,
    });
    setUploading(false);
    if (!response.ok) {
      const problem = await readImportProblem(response);
      setError(problem.detail ?? t("admin.module3.import.uploadError"));
      return;
    }
    const uploadResponse: ImportUploadResponse = await response.json();
    await refreshJob(uploadResponse.jobId, uploadResponse.preview);
  }

  async function refreshJob(jobId: string, fallbackPreview?: ImportPreview) {
    const response = await apiClient().GET("/v1/menu/import/{jobId}", {
      params: { path: { jobId } },
    });
    if (!response.data) {
      setJob(
        fallbackPreview
          ? {
              jobId,
              status: "pending_review",
              originalFilename: "",
              fileType: "csv",
              createdAt: new Date().toISOString(),
              preview: fallbackPreview,
            }
          : null,
      );
      return;
    }
    setJob(response.data);
  }

  async function commitJob() {
    if (!job || job.preview.summary.blockingErrors) return;
    setCommitting(true);
    setError(null);
    const response = await apiClient().POST("/v1/menu/import/{jobId}/commit", {
      params: { path: { jobId: job.jobId } },
    });
    setCommitting(false);
    if (!response.data) {
      const problem = readResponseProblem(response) as ImportProblem;
      if (problem.preview) {
        setJob({ ...job, preview: problem.preview });
      }
      setError(problem.detail ?? t("admin.module3.import.commitError"));
      return;
    }
    setCommitResult(response.data);
    await refreshJob(job.jobId);
    await onCommitted();
  }

  const preview = job?.preview;
  return (
    <section className="menu-import-panel" id={id}>
      <div className="section-heading-row">
        <div>
          <h2>{t("admin.module3.import.title")}</h2>
          <p>{t("admin.module3.import.description")}</p>
        </div>
        <button className="button-secondary" type="button" onClick={() => void downloadTemplate()}>
          {t("admin.module3.import.downloadTemplate")}
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {commitResult ? (
        <p className="form-success">
          {t("admin.module3.import.committed", {
            products: commitResult.counts.productsCreated + commitResult.counts.productsUpdated,
            variants: commitResult.counts.variantsCreated + commitResult.counts.variantsUpdated,
          })}
        </p>
      ) : null}

      <div className="menu-import-upload">
        <label>
          <span>{t("admin.module3.import.file")}</span>
          <input
            accept=".csv,.xlsx"
            disabled={uploading}
            type="file"
            onChange={(event) => void uploadFile(event)}
          />
        </label>
        {uploading ? <span className="status-pill">{t("admin.module3.import.uploading")}</span> : null}
      </div>

      {preview ? (
        <div className="menu-import-preview">
          <div className="menu-import-summary">
            <span>{t("admin.module3.import.rows", { count: preview.summary.rowCount })}</span>
            <span>{t("admin.module3.import.creates", { count: preview.summary.createCount })}</span>
            <span>{t("admin.module3.import.updates", { count: preview.summary.updateCount })}</span>
            <span className={preview.summary.blockingErrors ? "status-pill danger" : "status-pill"}>
              {preview.summary.blockingErrors
                ? t("admin.module3.import.blockingErrors")
                : t("admin.module3.import.ready")}
            </span>
          </div>
          <div className="menu-import-table" role="table" aria-label={t("admin.module3.import.preview")}>
            <div role="row" className="menu-import-table-head">
              <span>{t("admin.module3.import.row")}</span>
              <span>{t("admin.module3.import.action")}</span>
              <span>{t("admin.module3.import.category")}</span>
              <span>{t("admin.module3.import.product")}</span>
              <span>{t("admin.module3.import.variant")}</span>
              <span>{t("admin.module3.import.messages")}</span>
            </div>
            {preview.rows.map((row) => (
              <PreviewRow key={row.rowNumber} row={row} />
            ))}
          </div>
          <button
            disabled={committing || preview.summary.blockingErrors || job?.status !== "pending_review"}
            type="button"
            onClick={() => void commitJob()}
          >
            {committing ? t("admin.module3.import.committing") : t("admin.module3.import.commit")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function PreviewRow({ row }: { row: ImportPreviewRow }) {
  const { t } = useTranslation();
  const issues = [...row.errors, ...row.warnings];
  return (
    <div
      role="row"
      className={row.errors.length > 0 ? "menu-import-table-row error" : "menu-import-table-row"}
    >
      <span>{row.rowNumber}</span>
      <span>{t(`admin.module3.import.actionValue.${row.action}`)}</span>
      <span>{row.resolvedCategory?.name ?? row.normalized.category.localizedNames.fr}</span>
      <span>{row.resolvedProduct?.name ?? row.normalized.product.localizedNames.fr}</span>
      <span>{row.resolvedVariant?.name ?? row.normalized.variant.name}</span>
      <span>
        {issues.length === 0
          ? t("admin.module3.import.noIssues")
          : issues.map((issue) => issue.message).join(" | ")}
      </span>
    </div>
  );
}

async function readImportProblem(response: Response): Promise<ImportProblem> {
  try {
    const body: ImportProblem = await response.json();
    return body;
  } catch {
    return {};
  }
}
