"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatElapsedFr } from "@/lib/kitchen/elapsed";
import {
  appendLog,
  computeHealth,
  extractTableNumber,
  formatPollAgeFr,
  processBatch,
  trailingFailureStreak,
  LOG_CAP,
  POLL_INTERVAL_MS,
  PRINT_TIMEOUT_MS,
  RED_AFTER_MS,
  type KioskHealth,
  type KioskLogEntry,
  type PrintJob,
  type PrintJobDeps,
} from "@/lib/printing/kiosk";

type Station = "counter" | "kitchen" | "bar";

type Phase = "loading" | "error" | "ready";

type Printer = { id: string; name: string; station: Station };

type PollResponse = {
  printer: Printer;
  jobs: PrintJob[];
};

// Scoped print stylesheet. On screen the print area is `display: none` so it
// never shifts the kiosk layout; under `@media print` it is the only visible
// element, formatted for an 80mm thermal roll.
const PRINT_CSS = `
.kiosk-print-area { display: none; }
@media print {
  @page { size: 80mm auto; margin: 0; }
  body * { visibility: hidden; }
  .kiosk-print-area, .kiosk-print-area * { visibility: visible; }
  .kiosk-print-area {
    display: block;
    position: absolute;
    left: 0;
    top: 0;
    width: 72mm;
    padding: 2mm 4mm;
    font-family: ui-monospace, "SF Mono", Consolas, monospace;
    font-size: 12px;
    line-height: 1.25;
    color: #000;
    white-space: pre;
  }
}
`;

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

const STATION_LABELS: Record<Station, string> = {
  counter: "Comptoir",
  kitchen: "Cuisine",
  bar: "Bar",
};

// Resolves on the browser's `afterprint` event, or rejects after the hard
// 15-second upper bound so a stuck print dialog can never wedge the loop.
function waitForAfterPrint(timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", onAfterPrint);
    };
    const onAfterPrint = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("afterprint timeout"));
    }, timeoutMs);
    window.addEventListener("afterprint", onAfterPrint);
  });
}

async function postReport(url: string, body: object): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`report ${res.status}`);
}

function formatClock(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function KioskBridge({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [printer, setPrinter] = useState<Printer | null>(null);
  const [lastSuccessfulPollAt, setLastSuccessfulPollAt] = useState<
    number | null
  >(null);
  const [printFailureStreak, setPrintFailureStreak] = useState(0);
  const [currentJob, setCurrentJob] = useState<{ table: string } | null>(null);
  const [log, setLog] = useState<KioskLogEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [helpOpen, setHelpOpen] = useState(false);

  const printAreaRef = useRef<HTMLPreElement | null>(null);
  const processingRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  const requestWakeLock = useCallback(async () => {
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;
    try {
      wakeLockRef.current = await nav.wakeLock.request("screen");
    } catch {
      // Unsupported or denied — the kiosk still works, the screen may sleep.
    }
  }, []);

  const runBatch = useCallback(
    async (jobs: PrintJob[]) => {
      processingRef.current = true;
      const deps: PrintJobDeps = {
        renderPayload: (text) => {
          if (printAreaRef.current) printAreaRef.current.textContent = text;
        },
        triggerPrint: () => window.print(),
        awaitPrintComplete: () => waitForAfterPrint(PRINT_TIMEOUT_MS),
        reportPrinted: (jobId) =>
          postReport(`/api/print/jobs/${jobId}/printed`, { token }),
        reportFailed: (jobId, error) =>
          postReport(`/api/print/jobs/${jobId}/failed`, { token, error }),
      };

      const outcomes = await processBatch(jobs, deps, (job) => {
        setCurrentJob({ table: extractTableNumber(job.payload_text) });
      });

      const at = Date.now();
      setLog((prev) => {
        let next = prev;
        jobs.forEach((job, i) => {
          next = appendLog(next, {
            jobId: job.id,
            table: extractTableNumber(job.payload_text),
            payloadText: job.payload_text,
            at,
            outcome: outcomes[i]?.status === "failed" ? "failed" : "printed",
          });
        });
        return next;
      });
      setPrintFailureStreak(trailingFailureStreak(outcomes));
      setCurrentJob(null);
      processingRef.current = false;
    },
    [token],
  );

  const poll = useCallback(async () => {
    // Never poll while a batch is mid-print — concurrent prints break order.
    if (processingRef.current) return;
    let res: Response;
    try {
      res = await fetch(
        `/api/print/jobs?token=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
    } catch {
      // Network blip — the health machine surfaces it via the stale poll time.
      return;
    }
    if (res.status === 404) {
      setPhase("error");
      return;
    }
    if (!res.ok) return;

    const data = (await res.json()) as PollResponse;
    setPrinter(data.printer);
    setLastSuccessfulPollAt(Date.now());
    setPrintFailureStreak(0);
    setPhase("ready");

    if (data.jobs && data.jobs.length > 0) {
      await runBatch(data.jobs);
    }
  }, [token, runBatch]);

  // Boot sequence: an immediate poll. A 404 lands on the calm error screen with
  // no retry; a network failure keeps retrying every 4s until the printer
  // answers (Moroccan service-floor wifi is rarely up on the first try).
  useEffect(() => {
    if (phase !== "loading") return;
    void poll();
    const id = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [phase, poll]);

  // Steady-state polling loop: 4s cadence, paused while the tab is hidden,
  // resumed with an immediate fetch (and wake-lock re-acquire) on focus.
  useEffect(() => {
    if (phase !== "ready") return;
    let intervalId: number | null = null;
    const start = () => {
      if (intervalId !== null) return;
      intervalId = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (intervalId === null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        void poll();
        void requestWakeLock();
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase, poll, requestWakeLock]);

  // Best-effort screen wake lock for the whole shift.
  useEffect(() => {
    if (phase !== "ready") return;
    void requestWakeLock();
    return () => {
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [phase, requestWakeLock]);

  // 1s ticker so the idle "last poll" line and offline counter stay live.
  useEffect(() => {
    if (phase !== "ready") return;
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [phase]);

  // "Réimprimer" — re-runs the local print pipeline against the payload we
  // already hold in memory. No server round-trip; a server-side reprint lives
  // on the orders page.
  const reprint = useCallback(async (payloadText: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setCurrentJob({ table: extractTableNumber(payloadText) });
    try {
      if (printAreaRef.current) printAreaRef.current.textContent = payloadText;
      window.print();
      await waitForAfterPrint(PRINT_TIMEOUT_MS);
    } catch {
      // Local reprint — nothing to report, the merchant can try again.
    }
    setCurrentJob(null);
    processingRef.current = false;
  }, []);

  if (phase === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <style>{PRINT_CSS}</style>
        <p className="font-mono text-sm uppercase tracking-widest text-ink/40 font-bold">
          Connexion à l'imprimante…
        </p>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <style>{PRINT_CSS}</style>
        <div className="w-full max-w-[560px] border-4 border-accent px-10 py-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-accent font-bold">
            Jeton invalide
          </p>
          <p className="font-sans text-[18px] text-ink leading-snug mt-6">
            Jeton invalide ou imprimante supprimée. Régénérez le jeton depuis
            Paramètres › Imprimantes.
          </p>
        </div>
      </main>
    );
  }

  const health = computeHealth({
    now,
    lastSuccessfulPollAt,
    printFailureStreak,
  });
  const offlineMs =
    lastSuccessfulPollAt === null ? Infinity : now - lastSuccessfulPollAt;
  const isOffline = offlineMs > RED_AFTER_MS;
  const tokenTail = token.slice(-6);

  const statusBorder =
    health === "red"
      ? "border-4 border-accent"
      : health === "amber"
        ? "border-2 border-accent/40"
        : "border-2 border-ink";

  return (
    <main className="min-h-screen flex flex-col">
      <style>{PRINT_CSS}</style>

      {/* Top band */}
      <header className="border-b-2 border-ink px-8 md:px-10 py-6 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="font-mono font-bold text-2xl md:text-3xl uppercase tracking-tighter leading-none truncate">
            {printer?.name ?? "Imprimante"}
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink/50 mt-2">
            {printer ? STATION_LABELS[printer.station] : "—"} · Jeton …
            {tokenTail}
          </p>
          <p className="font-sans text-[13px] text-ink/55 mt-1 leading-snug">
            Pour quitter en toute sécurité : fermez simplement cet onglet.
          </p>
        </div>
        <div className="flex items-center gap-5 shrink-0">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="font-mono text-[10px] uppercase tracking-widest font-bold text-ink/50 hover:text-ink underline-offset-4 hover:underline transition-colors"
          >
            Mode kiosque ?
          </button>
          <HealthIndicator health={health} />
        </div>
      </header>

      {/* Center status block */}
      <section className="flex-1 flex items-center justify-center p-8">
        <div
          className={cn(
            "w-full max-w-[760px] px-10 py-16 md:py-20 text-center",
            statusBorder,
          )}
        >
          {health === "red" ? (
            isOffline ? (
              <>
                <p className="font-mono text-sm uppercase tracking-widest text-accent font-bold">
                  Hors ligne depuis
                </p>
                <p className="font-mono font-bold text-[88px] md:text-[112px] leading-none tracking-tighter mt-4 tabular-nums">
                  {formatElapsedFr(offlineMs)}
                </p>
              </>
            ) : (
              <p className="font-mono font-bold text-4xl md:text-5xl uppercase tracking-tight text-ink">
                Connexion interrompue
              </p>
            )
          ) : currentJob ? (
            <>
              <p className="font-mono text-sm uppercase tracking-widest text-ink/50 font-bold">
                Impression en cours…
              </p>
              <p className="font-mono text-[11px] uppercase tracking-widest text-ink/40 mt-8">
                Table
              </p>
              <p className="font-mono font-bold text-[64px] leading-none tracking-tighter mt-1">
                {currentJob.table}
              </p>
            </>
          ) : (
            <>
              <p className="font-mono font-bold text-4xl md:text-5xl uppercase tracking-tight text-ink">
                En attente de commandes
              </p>
              <p className="font-mono text-[12px] uppercase tracking-widest text-ink/45 mt-8">
                Dernière vérification{" "}
                {lastSuccessfulPollAt === null
                  ? "—"
                  : formatPollAgeFr(now - lastSuccessfulPollAt)}
              </p>
            </>
          )}
        </div>
      </section>

      {/* Bottom: rolling in-session log */}
      <section className="border-t-2 border-ink">
        <header className="px-8 md:px-10 py-3 border-b border-outline flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40 font-bold">
            Journal de session
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40 font-bold tabular-nums">
            {log.length} / {LOG_CAP}
          </span>
        </header>
        <ul className="max-h-[32vh] overflow-y-auto no-scrollbar">
          {log.length === 0 ? (
            <li className="px-8 md:px-10 py-6 font-sans text-[13px] text-ink/45">
              Aucune impression pour le moment.
            </li>
          ) : (
            log.map((entry) => (
              <li
                key={`${entry.jobId}-${entry.at}`}
                className="px-8 md:px-10 py-3 border-b border-outline last:border-b-0 flex items-center justify-between gap-4"
              >
                <div className="flex items-baseline gap-4 min-w-0">
                  <span className="font-mono font-bold text-[18px] leading-none tabular-nums w-16 shrink-0">
                    {entry.table}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-ink/45 tabular-nums">
                    {formatClock(entry.at)}
                  </span>
                  {entry.outcome === "failed" ? (
                    <span className="font-mono text-[9px] uppercase tracking-widest font-bold text-accent border border-accent px-1.5 py-0.5">
                      Échec
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void reprint(entry.payloadText)}
                  className="font-mono text-[10px] uppercase tracking-widest font-bold border border-ink px-3 py-2 hover:bg-ink hover:text-base transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20 shrink-0"
                >
                  Réimprimer
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Hidden print surface — visible only under @media print */}
      <pre ref={printAreaRef} className="kiosk-print-area" aria-hidden />

      {helpOpen ? <HelpDrawer onClose={() => setHelpOpen(false)} /> : null}
    </main>
  );
}

function HealthIndicator({ health }: { health: KioskHealth }) {
  const label =
    health === "green"
      ? "En ligne"
      : health === "amber"
        ? "Ralenti"
        : "Hors ligne";
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={cn(
          "w-2.5 h-2.5 animate-pulse",
          health === "green" ? "bg-ink" : "bg-accent",
        )}
      />
      <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-ink/50">
        {label}
      </span>
    </div>
  );
}

function HelpDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="flex-1 bg-ink/20"
      />
      <aside className="w-full max-w-[420px] h-full bg-base border-l-2 border-ink p-8 flex flex-col gap-8 overflow-y-auto">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-mono font-bold text-lg uppercase tracking-widest">
            Mode kiosque
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-widest font-bold border border-ink px-3 py-2 hover:bg-ink hover:text-base transition-colors"
          >
            Fermer
          </button>
        </div>
        <ol className="flex flex-col gap-6">
          <li>
            <p className="font-mono text-[11px] uppercase tracking-widest text-ink/40 font-bold mb-1.5">
              Étape 1
            </p>
            <p className="font-sans text-[14px] text-ink leading-snug">
              Lancez Chrome avec{" "}
              <code className="font-mono text-[13px] bg-black/[0.04] px-1 py-0.5">
                --kiosk-printing
              </code>{" "}
              ou activez l'impression silencieuse.
            </p>
          </li>
          <li>
            <p className="font-mono text-[11px] uppercase tracking-widest text-ink/40 font-bold mb-1.5">
              Étape 2
            </p>
            <p className="font-sans text-[14px] text-ink leading-snug">
              Imprimante par défaut = votre imprimante thermique 80mm.
            </p>
          </li>
        </ol>
      </aside>
    </div>
  );
}
