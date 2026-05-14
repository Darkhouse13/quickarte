"use client";

import { useState, useTransition } from "react";
import { RefreshCw, TestTube2, Trash2 } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormToggle } from "@/components/ui/form-toggle";
import {
  createPrinter,
  deletePrinter,
  enqueueTestPrint,
  regenerateWebprintToken,
  setCategoryRoute,
  updatePrinter,
} from "@/lib/printing/actions";
import type {
  PrinterConnectionType,
  PrinterStation,
} from "@/lib/printing/pipeline";

type PrinterRow = {
  id: string;
  name: string;
  station: PrinterStation;
  connectionType: PrinterConnectionType;
  webprintToken: string | null;
  lastSeenAt: string | null;
  enabled: boolean;
  pendingCount: number;
};

type PrinterSettingsProps = {
  printers: PrinterRow[];
  appUrl: string;
  routing: RoutingSettings;
};

type RoutingSettings = {
  categories: { id: string; name: string }[];
  routes: { categoryId: string; station: PrinterStation }[];
  stationPrinterCounts: Record<PrinterStation, number>;
  categoryNamesByStation: Record<PrinterStation, string[]>;
};

const stationOptions = [
  { value: "counter", label: "Comptoir" },
  { value: "kitchen", label: "Cuisine" },
  { value: "bar", label: "Bar" },
];

const typeOptions = [
  { value: "manual", label: "Manuel" },
  { value: "webprint", label: "Webprint" },
];

export function PrinterSettings({
  printers,
  appUrl,
  routing,
}: PrinterSettingsProps) {
  const [name, setName] = useState("");
  const [station, setStation] = useState<PrinterStation>("counter");
  const [connectionType, setConnectionType] =
    useState<PrinterConnectionType>("webprint");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const addPrinter = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await createPrinter({ name, station, connectionType });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      setMessage("Imprimante ajoutee.");
    });
  };

  return (
    <div className="flex flex-col">
      <section className="px-6 py-5 border-b-4 border-outline flex flex-col gap-4">
        <FormInput
          label="Nom"
          name="printerName"
          placeholder="Comptoir"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
          <FormSelect
            label="Station"
            name="station"
            value={station}
            options={stationOptions}
            onChange={(event) => setStation(event.target.value as PrinterStation)}
          />
          <FormSelect
            label="Type"
            name="connectionType"
            value={connectionType}
            options={typeOptions}
            onChange={(event) =>
              setConnectionType(event.target.value as PrinterConnectionType)
            }
          />
        </div>
        <button
          type="button"
          onClick={addPrinter}
          disabled={pending}
          className="bg-ink text-base px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60"
        >
          {pending ? "..." : "Ajouter l'imprimante"}
        </button>
        {error ? <StatusText tone="error">{error}</StatusText> : null}
        {message ? <StatusText>{message}</StatusText> : null}
      </section>

      <section className="flex flex-col">
        {printers.length === 0 ? (
          <p className="px-6 py-10 font-sans text-sm text-ink/55 leading-snug">
            Aucune imprimante configuree.
          </p>
        ) : (
          printers.map((printer) => (
            <PrinterItem
              key={printer.id}
              printer={printer}
              appUrl={appUrl}
              receivedCategoryNames={receivedCategoryNames(
                printer.station,
                routing,
              )}
            />
          ))
        )}
      </section>

      <StationRoutingTable routing={routing} />
    </div>
  );
}

function PrinterItem({
  printer,
  appUrl,
  receivedCategoryNames,
}: {
  printer: PrinterRow;
  appUrl: string;
  receivedCategoryNames: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [localEnabled, setLocalEnabled] = useState(printer.enabled);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kioskUrl = printer.webprintToken
    ? `${appUrl.replace(/\/$/, "")}/print/${printer.webprintToken}`
    : null;

  const run = (action: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Enregistre.");
    });
  };

  const toggleEnabled = (enabled: boolean) => {
    setLocalEnabled(enabled);
    run(() => updatePrinter({ id: printer.id, enabled }));
  };

  return (
    <article className="px-6 py-5 border-b border-outline flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-sans font-bold text-[16px] leading-tight truncate">
            {printer.name}
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink/45 mt-1">
            {stationLabel(printer.station)} / {typeLabel(printer.connectionType)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono font-bold text-[13px] leading-none">
            {printer.pendingCount}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 mt-1">
            en attente
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
        <FormSelect
          label="Station"
          name={`station-${printer.id}`}
          value={printer.station}
          options={stationOptions}
          onChange={(event) =>
            run(() =>
              updatePrinter({
                id: printer.id,
                station: event.target.value as PrinterStation,
              }),
            )
          }
        />
        <div className="border border-outline px-4 py-2">
          <FormToggle
            label="Active"
            checked={localEnabled}
            onCheckedChange={toggleEnabled}
            disabled={pending}
            className="mt-0"
          />
        </div>
      </div>

      <p className="font-sans text-sm text-ink/55 leading-snug">
        {printer.lastSeenAt ? formatSeen(printer.lastSeenAt) : "Jamais vu"}
      </p>
      <p className="font-sans text-sm text-ink/60 leading-snug">
        Recoit :{" "}
        {receivedCategoryNames.length > 0
          ? receivedCategoryNames.join(" · ")
          : "Aucune categorie routable"}
      </p>

      {kioskUrl ? (
        <div className="flex flex-col gap-2">
          <CopyButton value={kioskUrl} label="Copier l'URL kiosk" />
          <button
            type="button"
            onClick={() => run(() => regenerateWebprintToken(printer.id))}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 border-2 border-ink px-4 py-3 font-mono text-[11px] uppercase tracking-widest font-bold hover:bg-ink hover:text-base transition-colors disabled:opacity-60"
          >
            <RefreshCw size={14} aria-hidden />
            Regenerer le jeton
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => run(() => enqueueTestPrint(printer.id))}
          disabled={pending || !localEnabled}
          className="inline-flex items-center justify-center gap-2 bg-ink text-base border-2 border-ink px-4 py-3 font-mono text-[11px] uppercase tracking-widest font-bold hover:bg-accent transition-colors disabled:opacity-60"
        >
          <TestTube2 size={14} aria-hidden />
          Test d'impression
        </button>
        <button
          type="button"
          onClick={() => run(() => deletePrinter(printer.id))}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 border-2 border-accent text-accent px-4 py-3 font-mono text-[11px] uppercase tracking-widest font-bold hover:bg-accent hover:text-base transition-colors disabled:opacity-60"
        >
          <Trash2 size={14} aria-hidden />
          Supprimer
        </button>
      </div>

      {error ? <StatusText tone="error">{error}</StatusText> : null}
      {message ? <StatusText>{message}</StatusText> : null}
    </article>
  );
}

function StationRoutingTable({ routing }: { routing: RoutingSettings }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const routeKeys = new Set(
    routing.routes.map((route) => `${route.categoryId}:${route.station}`),
  );
  const routeCounts = new Map<string, number>();
  for (const route of routing.routes) {
    routeCounts.set(route.categoryId, (routeCounts.get(route.categoryId) ?? 0) + 1);
  }

  const toggleRoute = (
    categoryId: string,
    station: PrinterStation,
    enabled: boolean,
  ) => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await setCategoryRoute({ categoryId, station, enabled });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Routage enregistre.");
    });
  };

  return (
    <section className="px-6 py-5 border-t-4 border-outline flex flex-col gap-4">
      <div>
        <h2 className="font-mono font-bold text-[15px] uppercase tracking-widest">
          Routage des stations
        </h2>
        <p className="font-sans text-sm text-ink/55 leading-snug mt-2">
          Les categories sans routage restent imprimees partout.
        </p>
      </div>

      <div className="overflow-x-auto border-2 border-outline">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-outline">
              <th className="px-3 py-2 font-mono text-[11px] uppercase tracking-widest">
                Categorie
              </th>
              {stationOptions.map((station) => (
                <th
                  key={station.value}
                  className="px-3 py-2 font-mono text-[11px] uppercase tracking-widest"
                >
                  <span>{station.label}</span>
                  {routing.stationPrinterCounts[station.value as PrinterStation] ===
                  0 ? (
                    <span className="block normal-case tracking-normal font-sans text-[12px] text-ink/45 mt-1">
                      Aucune imprimante associee a cette station pour le moment.
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {routing.categories.map((category) => (
              <tr key={category.id} className="border-b border-outline last:border-0">
                <td className="px-3 py-3 font-sans text-sm font-bold">
                  {category.name}
                  {(routeCounts.get(category.id) ?? 0) === 0 ? (
                    <span className="block font-normal text-[12px] text-ink/45 mt-1">
                      Sans routage : sera imprimee partout.
                    </span>
                  ) : null}
                </td>
                {stationOptions.map((station) => {
                  const value = station.value as PrinterStation;
                  const checked = routeKeys.has(`${category.id}:${value}`);
                  return (
                    <td key={value} className="px-3 py-3 align-top">
                      <label className="inline-flex min-h-9 min-w-9 items-center justify-center border-2 border-ink hover:bg-ink hover:text-base transition-colors">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-ink"
                          checked={checked}
                          disabled={pending}
                          onChange={(event) =>
                            toggleRoute(category.id, value, event.target.checked)
                          }
                          aria-label={`${category.name} ${station.label}`}
                        />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {routing.categories.length === 0 ? (
        <p className="font-sans text-sm text-ink/55 leading-snug">
          Aucune categorie catalogue pour le moment.
        </p>
      ) : null}
      {error ? <StatusText tone="error">{error}</StatusText> : null}
      {message ? <StatusText>{message}</StatusText> : null}
    </section>
  );
}

function receivedCategoryNames(
  station: PrinterStation,
  routing: RoutingSettings,
): string[] {
  if (station === "counter") return routing.categories.map((category) => category.name);

  const routeCounts = new Map<string, number>();
  for (const route of routing.routes) {
    routeCounts.set(route.categoryId, (routeCounts.get(route.categoryId) ?? 0) + 1);
  }

  const explicit = new Set(routing.categoryNamesByStation[station]);
  for (const category of routing.categories) {
    if ((routeCounts.get(category.id) ?? 0) === 0) explicit.add(category.name);
  }
  return [...explicit];
}

function StatusText({
  children,
  tone = "success",
}: {
  children: React.ReactNode;
  tone?: "success" | "error";
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "font-mono text-[11px] uppercase tracking-widest text-accent"
          : "font-mono text-[11px] uppercase tracking-widest text-ink/55"
      }
    >
      {children}
    </p>
  );
}

function stationLabel(station: PrinterStation): string {
  if (station === "kitchen") return "Cuisine";
  if (station === "bar") return "Bar";
  return "Comptoir";
}

function typeLabel(type: PrinterConnectionType): string {
  return type === "webprint" ? "Webprint" : "Manuel";
}

function formatSeen(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return "Vu a l'instant";
  if (minutes < 60) return `Vu il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Vu il y a ${hours} h`;
  return `Vu il y a ${Math.floor(hours / 24)} j`;
}
