import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { paths } from "@quickarte/shared-types";
import { apiClient, readResponseProblem } from "../auth/api";

type BranchListResponse =
  paths["/v1/branches"]["get"]["responses"][200]["content"]["application/json"];
type Branch = BranchListResponse["branches"][number];
type PrintersResponse =
  paths["/v1/branches/{branchId}/printers"]["get"]["responses"][200]["content"]["application/json"];
type Printer = PrintersResponse["printers"][number];
type Assignment = PrintersResponse["assignments"][number];
type CreatePrinterBody =
  paths["/v1/branches/{branchId}/printers"]["post"]["requestBody"]["content"]["application/json"];
type UpdatePrinterBody =
  paths["/v1/branches/{branchId}/printers/{printerId}"]["patch"]["requestBody"]["content"]["application/json"];
type AssignmentsBody =
  paths["/v1/branches/{branchId}/printer-assignments"]["put"]["requestBody"]["content"]["application/json"];
type AssignmentRole = Assignment["role"];
type ConnectionType = Printer["connectionType"];

const CONNECTION_TYPES: ConnectionType[] = [
  "manual",
  "webprint",
  "escpos_lan",
  "escpos_usb",
  "bluetooth",
];
const ASSIGNMENT_ROLES: AssignmentRole[] = [
  "receipt",
  "kitchen",
  "bar",
  "customer_copy",
];

const emptyPrinter: CreatePrinterBody = {
  name: "",
  connectionType: "manual",
  address: null,
  model: null,
  notes: null,
  enabled: true,
};

export function PrinterSetupPage() {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [form, setForm] = useState<CreatePrinterBody>(emptyPrinter);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    const response = await apiClient().GET("/v1/branches");
    if (response.error || !response.data) {
      setError(t("admin.module2.branches.loadError"));
      return;
    }
    setBranches(response.data.branches);
    setBranchId((current) => current || response.data.branches[0]?.id || "");
  }, [t]);

  const loadPrinters = useCallback(
    async (nextBranchId: string) => {
      if (!nextBranchId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const response = await apiClient().GET("/v1/branches/{branchId}/printers", {
        params: { path: { branchId: nextBranchId } },
      });
      setLoading(false);
      if (response.error || !response.data) {
        setError(t("admin.module2.printers.loadError"));
        return;
      }
      setPrinters(response.data.printers);
      setAssignments(response.data.assignments);
    },
    [t],
  );

  useEffect(() => {
    void Promise.resolve().then(loadBranches);
  }, [loadBranches]);

  useEffect(() => {
    void Promise.resolve().then(() => loadPrinters(branchId));
  }, [branchId, loadPrinters]);

  async function submitPrinter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);

    const body = normalizePrinterBody(form);
    const response = editingId
      ? await apiClient().PATCH("/v1/branches/{branchId}/printers/{printerId}", {
          params: { path: { branchId, printerId: editingId } },
          body: body satisfies UpdatePrinterBody,
        })
      : await apiClient().POST("/v1/branches/{branchId}/printers", {
          params: { path: { branchId } },
          body,
        });

    setSaving(false);
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module2.printers.saveError"));
      return;
    }
    setForm(emptyPrinter);
    setEditingId(null);
    setMessage(t("admin.module2.printers.saved"));
    await loadPrinters(branchId);
  }

  async function deletePrinter(printerId: string) {
    if (!branchId || !window.confirm(t("admin.module2.printers.deleteConfirm"))) {
      return;
    }
    const response = await apiClient().DELETE("/v1/branches/{branchId}/printers/{printerId}", {
      params: { path: { branchId, printerId } },
    });
    if (response.error) {
      setError(readResponseProblem(response).detail ?? t("admin.module2.printers.saveError"));
      return;
    }
    setMessage(t("admin.module2.printers.saved"));
    await loadPrinters(branchId);
  }

  async function testPrint(printerId: string) {
    if (!branchId) {
      return;
    }
    const response = await apiClient().POST(
      "/v1/branches/{branchId}/printers/{printerId}/test-print",
      { params: { path: { branchId, printerId } } },
    );
    if (response.error || !response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module2.printers.testError"));
      return;
    }
    setMessage(t("admin.module2.printers.testQueued"));
    await loadPrinters(branchId);
  }

  async function saveAssignments() {
    if (!branchId) {
      return;
    }
    setSaving(true);
    setError(null);
    const body: AssignmentsBody = {
      assignments: assignments.map((assignment, index) => ({
        role: assignment.role,
        printerId: assignment.printerId,
        fallbackPrinterId: assignment.fallbackPrinterId,
        priority: index,
        enabled: assignment.enabled,
      })),
    };
    const response = await apiClient().PUT("/v1/branches/{branchId}/printer-assignments", {
      params: { path: { branchId } },
      body,
    });
    setSaving(false);
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module2.printers.assignmentError"));
      return;
    }
    setPrinters(response.data.printers);
    setAssignments(response.data.assignments);
    setMessage(t("admin.module2.printers.assignmentsSaved"));
  }

  function editPrinter(printer: Printer) {
    setEditingId(printer.id);
    setForm({
      name: printer.name,
      connectionType: printer.connectionType,
      address: printer.address,
      model: printer.model,
      notes: printer.notes,
      enabled: printer.enabled,
    });
  }

  function upsertAssignment(role: AssignmentRole, printerId: string) {
    setAssignments((current) => {
      const existingIndex = current.findIndex((assignment) => assignment.role === role);
      const next: Assignment = {
        id: current[existingIndex]?.id ?? `draft-${role}`,
        branchId,
        role,
        printerId,
        fallbackPrinterId: current[existingIndex]?.fallbackPrinterId ?? null,
        priority: current[existingIndex]?.priority ?? existingIndex,
        enabled: Boolean(printerId),
      };
      if (existingIndex >= 0) {
        return current.map((assignment, index) => (index === existingIndex ? next : assignment));
      }
      return [...current, next];
    });
  }

  function setFallback(role: AssignmentRole, fallbackPrinterId: string) {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.role === role
          ? { ...assignment, fallbackPrinterId: fallbackPrinterId || null }
          : assignment,
      ),
    );
  }

  return (
    <section className="settings-page">
      <div className="page-heading">
        <p className="eyebrow">{t("admin.module2.eyebrow")}</p>
        <h1>{t("admin.module2.printers.title")}</h1>
      </div>

      {loading ? <p>{t("admin.dashboard.loading")}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

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
      </div>

      <form className="settings-form" onSubmit={(event) => void submitPrinter(event)}>
        <section className="data-panel">
          <h2>
            {editingId
              ? t("admin.module2.printers.editTitle")
              : t("admin.module2.printers.addTitle")}
          </h2>
          <div className="form-grid">
            <label>
              <span>{t("admin.module2.printers.name")}</span>
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label>
              <span>{t("admin.module2.printers.connectionType")}</span>
              <select
                value={form.connectionType}
                onChange={(event) =>
                  setForm({ ...form, connectionType: event.target.value as ConnectionType })
                }
              >
                {CONNECTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`admin.module2.printers.connectionTypes.${type}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("admin.module2.printers.address")}</span>
              <input
                value={form.address ?? ""}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </label>
            <label>
              <span>{t("admin.module2.printers.model")}</span>
              <input
                value={form.model ?? ""}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
              />
            </label>
            <label className="form-grid-wide">
              <span>{t("admin.module2.printers.notes")}</span>
              <textarea
                value={form.notes ?? ""}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>
            <label className="toggle-row">
              <input
                checked={form.enabled}
                onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
                type="checkbox"
              />
              <span>{t("admin.module2.printers.enabled")}</span>
            </label>
          </div>
          <div className="row-actions">
            <button disabled={saving || !branchId} type="submit">
              {saving ? t("admin.module2.saving") : t("form.actions.save")}
            </button>
            {editingId ? (
              <button
                className="button-secondary"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyPrinter);
                }}
              >
                {t("form.actions.cancel")}
              </button>
            ) : null}
          </div>
        </section>
      </form>

      <section className="data-panel">
        <h2>{t("admin.module2.printers.listTitle")}</h2>
        <div className="settings-list">
          {printers.map((printer) => (
            <article className="method-row" key={printer.id}>
              <div>
                <strong>{printer.name}</strong>
                <p>
                  {t(`admin.module2.printers.connectionTypes.${printer.connectionType}`)}
                  {printer.address ? ` - ${printer.address}` : ""}
                </p>
              </div>
              <span className="status-pill">
                {printer.enabled
                  ? t("admin.module2.printers.enabled")
                  : t("admin.module2.printers.disabled")}
              </span>
              <div className="row-actions">
                <button className="button-secondary" type="button" onClick={() => editPrinter(printer)}>
                  {t("admin.module2.branches.edit")}
                </button>
                <button className="button-secondary" type="button" onClick={() => void testPrint(printer.id)}>
                  {t("admin.module2.printers.testPrint")}
                </button>
                <button className="button-secondary" type="button" onClick={() => void deletePrinter(printer.id)}>
                  {t("admin.module2.branches.deactivate")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="data-panel">
        <h2>{t("admin.module2.printers.assignments")}</h2>
        <div className="settings-list">
          {ASSIGNMENT_ROLES.map((role) => {
            const assignment = assignments.find((item) => item.role === role);
            return (
              <article className="method-row" key={role}>
                <strong>{t(`admin.module2.printers.roles.${role}`)}</strong>
                <select
                  value={assignment?.printerId ?? ""}
                  onChange={(event) => upsertAssignment(role, event.target.value)}
                >
                  <option value="">{t("admin.module2.printers.noPrinter")}</option>
                  {printers.map((printer) => (
                    <option key={printer.id} value={printer.id}>
                      {printer.name}
                    </option>
                  ))}
                </select>
                <select
                  value={assignment?.fallbackPrinterId ?? ""}
                  onChange={(event) => setFallback(role, event.target.value)}
                >
                  <option value="">{t("admin.module2.printers.noFallback")}</option>
                  {printers
                    .filter((printer) => printer.id !== assignment?.printerId)
                    .map((printer) => (
                      <option key={printer.id} value={printer.id}>
                        {printer.name}
                      </option>
                    ))}
                </select>
              </article>
            );
          })}
        </div>
        <button disabled={saving || !branchId} type="button" onClick={() => void saveAssignments()}>
          {saving ? t("admin.module2.saving") : t("admin.module2.printers.saveAssignments")}
        </button>
      </section>
    </section>
  );
}

function normalizePrinterBody(input: CreatePrinterBody): CreatePrinterBody {
  return {
    name: input.name,
    connectionType: input.connectionType,
    address: emptyToNull(input.address),
    model: emptyToNull(input.model),
    notes: emptyToNull(input.notes),
    enabled: input.enabled,
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

