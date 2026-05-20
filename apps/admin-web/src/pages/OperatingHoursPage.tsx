import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { paths } from "@quickarte/shared-types";
import { apiClient, readResponseProblem } from "../auth/api";

type BranchListResponse =
  paths["/v1/branches"]["get"]["responses"][200]["content"]["application/json"];
type Branch = BranchListResponse["branches"][number];
type OperatingHoursResponse =
  paths["/v1/branches/{branchId}/operating-hours"]["get"]["responses"][200]["content"]["application/json"];
type OperatingHoursBody =
  paths["/v1/branches/{branchId}/operating-hours"]["put"]["requestBody"]["content"]["application/json"];
type ScheduleInput = OperatingHoursBody["normal"][number];
type ClosedDayInput = OperatingHoursBody["closedDays"][number];
type ScheduleType = "normal" | "ramadan";

const dayIndexes = [0, 1, 2, 3, 4, 5, 6] as const;

export function OperatingHoursPage() {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [normal, setNormal] = useState<ScheduleInput[]>([]);
  const [ramadan, setRamadan] = useState<ScheduleInput[]>([]);
  const [closedDays, setClosedDays] = useState<ClosedDayInput[]>([]);
  const [ramadanModeEnabled, setRamadanModeEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === branchId) ?? null,
    [branches, branchId],
  );

  const applyResponse = useCallback((response: OperatingHoursResponse) => {
    setRamadanModeEnabled(response.ramadanModeEnabled);
    setNormal(response.normal.map(toInput));
    setRamadan(response.ramadan.map(toInput));
    setClosedDays(response.closedDays.map((day) => ({ date: day.date, reason: day.reason })));
  }, []);

  const loadBranches = useCallback(async () => {
    const response = await apiClient().GET("/v1/branches");
    if (response.error || !response.data) {
      setError(t("admin.module2.branches.loadError"));
      return;
    }
    setBranches(response.data.branches);
    setBranchId((current) => current || response.data.branches[0]?.id || "");
  }, [t]);

  const loadHours = useCallback(
    async (nextBranchId: string) => {
      if (!nextBranchId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const response = await apiClient().GET("/v1/branches/{branchId}/operating-hours", {
        params: { path: { branchId: nextBranchId } },
      });
      setLoading(false);
      if (response.error || !response.data) {
        setError(t("admin.module2.operatingHours.loadError"));
        return;
      }
      applyResponse(response.data);
    },
    [applyResponse, t],
  );

  useEffect(() => {
    void Promise.resolve().then(loadBranches);
  }, [loadBranches]);

  useEffect(() => {
    void Promise.resolve().then(() => loadHours(branchId));
  }, [branchId, loadHours]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);

    const body: OperatingHoursBody = {
      ramadanModeEnabled,
      normal,
      ramadan,
      closedDays,
    };
    const response = await apiClient().PUT("/v1/branches/{branchId}/operating-hours", {
      params: { path: { branchId } },
      body,
    });

    setSaving(false);
    if (!response.data) {
      setError(readResponseProblem(response).detail ?? t("admin.module2.operatingHours.saveError"));
      return;
    }
    applyResponse(response.data);
    setMessage(t("admin.module2.operatingHours.saved"));
  }

  function updateInterval(
    scheduleType: ScheduleType,
    index: number,
    patch: Partial<ScheduleInput>,
  ) {
    const setter = scheduleType === "normal" ? setNormal : setRamadan;
    setter((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addInterval(scheduleType: ScheduleType, dayOfWeek: number) {
    const setter = scheduleType === "normal" ? setNormal : setRamadan;
    setter((current) => [
      ...current,
      {
        dayOfWeek,
        opensAt: "09:00",
        closesAt: "18:00",
        isClosed: false,
        position: nextPosition(current, dayOfWeek),
      },
    ]);
  }

  function removeInterval(scheduleType: ScheduleType, index: number) {
    const setter = scheduleType === "normal" ? setNormal : setRamadan;
    setter((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function addClosedDay() {
    setClosedDays((current) => [...current, { date: "", reason: null }]);
  }

  function updateClosedDay(index: number, patch: Partial<ClosedDayInput>) {
    setClosedDays((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function removeClosedDay(index: number) {
    setClosedDays((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <section className="settings-page">
      <div className="page-heading">
        <p className="eyebrow">{t("admin.module2.eyebrow")}</p>
        <h1>{t("admin.module2.operatingHours.title")}</h1>
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
          <label className="toggle-row">
            <input
              checked={ramadanModeEnabled}
              onChange={(event) => setRamadanModeEnabled(event.target.checked)}
              type="checkbox"
            />
            <span>{t("admin.module2.operatingHours.ramadanMode")}</span>
          </label>
        </div>

        <ScheduleEditor
          rows={normal}
          scheduleType="normal"
          title={t("admin.module2.operatingHours.normal")}
          onAdd={addInterval}
          onRemove={removeInterval}
          onUpdate={updateInterval}
        />
        <ScheduleEditor
          rows={ramadan}
          scheduleType="ramadan"
          title={t("admin.module2.operatingHours.ramadan")}
          onAdd={addInterval}
          onRemove={removeInterval}
          onUpdate={updateInterval}
        />

        <section className="data-panel">
          <div className="section-heading-row">
            <h2>{t("admin.module2.operatingHours.closedDays")}</h2>
            <button type="button" onClick={addClosedDay}>
              {t("admin.module2.operatingHours.addClosedDay")}
            </button>
          </div>
          <div className="settings-list">
            {closedDays.map((day, index) => (
              <div className="inline-row" key={`${day.date}-${index}`}>
                <input
                  aria-label={t("admin.module2.operatingHours.closedDate")}
                  onChange={(event) => updateClosedDay(index, { date: event.target.value })}
                  required
                  type="date"
                  value={day.date}
                />
                <input
                  aria-label={t("admin.module2.operatingHours.closedReason")}
                  onChange={(event) =>
                    updateClosedDay(index, { reason: emptyToNull(event.target.value) })
                  }
                  placeholder={t("admin.module2.operatingHours.closedReason")}
                  value={day.reason ?? ""}
                />
                <button className="button-secondary" type="button" onClick={() => removeClosedDay(index)}>
                  {t("form.actions.cancel")}
                </button>
              </div>
            ))}
          </div>
        </section>

        <button disabled={saving || !selectedBranch} type="submit">
          {saving ? t("admin.module2.saving") : t("form.actions.save")}
        </button>
      </form>
    </section>
  );
}

type ScheduleEditorProps = {
  rows: ScheduleInput[];
  scheduleType: ScheduleType;
  title: string;
  onAdd: (scheduleType: ScheduleType, dayOfWeek: number) => void;
  onRemove: (scheduleType: ScheduleType, index: number) => void;
  onUpdate: (scheduleType: ScheduleType, index: number, patch: Partial<ScheduleInput>) => void;
};

function ScheduleEditor({ rows, scheduleType, title, onAdd, onRemove, onUpdate }: ScheduleEditorProps) {
  const { t } = useTranslation();

  return (
    <section className="data-panel">
      <h2>{title}</h2>
      {dayIndexes.map((dayOfWeek) => {
        const dayRows = rows
          .map((row, index) => ({ ...row, index }))
          .filter((row) => row.dayOfWeek === dayOfWeek)
          .sort((left, right) => left.position - right.position);

        return (
          <div className="day-editor" key={`${scheduleType}-${dayOfWeek}`}>
            <div className="section-heading-row">
              <h3>{t(`admin.module2.operatingHours.days.${dayOfWeek}`)}</h3>
              <button type="button" onClick={() => onAdd(scheduleType, dayOfWeek)}>
                {t("admin.module2.operatingHours.addInterval")}
              </button>
            </div>
            <div className="settings-list">
              {dayRows.map((row) => (
                <div className="inline-row" key={`${scheduleType}-${dayOfWeek}-${row.index}`}>
                  <label className="toggle-row">
                    <input
                      checked={row.isClosed}
                      onChange={(event) =>
                        onUpdate(scheduleType, row.index, {
                          isClosed: event.target.checked,
                          opensAt: event.target.checked ? null : (row.opensAt ?? "09:00"),
                          closesAt: event.target.checked ? null : (row.closesAt ?? "18:00"),
                        })
                      }
                      type="checkbox"
                    />
                    <span>{t("admin.module2.operatingHours.closed")}</span>
                  </label>
                  <input
                    aria-label={t("admin.module2.operatingHours.opensAt")}
                    disabled={row.isClosed}
                    onChange={(event) => onUpdate(scheduleType, row.index, { opensAt: event.target.value })}
                    type="time"
                    value={row.opensAt ?? ""}
                  />
                  <input
                    aria-label={t("admin.module2.operatingHours.closesAt")}
                    disabled={row.isClosed}
                    onChange={(event) => onUpdate(scheduleType, row.index, { closesAt: event.target.value })}
                    type="time"
                    value={row.closesAt ?? ""}
                  />
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => onRemove(scheduleType, row.index)}
                  >
                    {t("form.actions.cancel")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function toInput(row: OperatingHoursResponse["normal"][number]): ScheduleInput {
  return {
    dayOfWeek: row.dayOfWeek,
    opensAt: row.opensAt,
    closesAt: row.closesAt,
    isClosed: row.isClosed,
    position: row.position,
  };
}

function nextPosition(rows: ScheduleInput[], dayOfWeek: number): number {
  return rows.filter((row) => row.dayOfWeek === dayOfWeek).length;
}

function emptyToNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}
