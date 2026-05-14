// Pure, framework-free kiosk logic. The /print/[token] bridge page wires these
// helpers to the browser print pipeline; keeping them here makes the connection
// health machine, the log buffer, and the sequential print loop unit-testable
// without a DOM.

export type KioskHealth = "green" | "amber" | "red";

export const POLL_INTERVAL_MS = 4_000;
export const PRINT_TIMEOUT_MS = 15_000;
export const AMBER_AFTER_MS = 15_000;
export const RED_AFTER_MS = 2 * 60_000;
export const RED_FAILURE_STREAK = 3;
export const LOG_CAP = 20;

export type PrintJob = {
  id: string;
  payload_text: string;
  created_at: string;
  order_id: string | null;
  attempts: number;
};

// --- Connection health -----------------------------------------------------

export function computeHealth(input: {
  now: number;
  lastSuccessfulPollAt: number | null;
  printFailureStreak: number;
}): KioskHealth {
  const { now, lastSuccessfulPollAt, printFailureStreak } = input;

  // Three consecutive failed prints means the pipeline is broken even if the
  // network is fine — escalate straight to red.
  if (printFailureStreak >= RED_FAILURE_STREAK) return "red";

  // No poll has ever landed: treat as offline rather than optimistically green.
  if (lastSuccessfulPollAt === null) return "red";

  const sincePoll = now - lastSuccessfulPollAt;
  if (sincePoll > RED_AFTER_MS) return "red";
  if (sincePoll >= AMBER_AFTER_MS) return "amber";
  return "green";
}

// --- Ticket parsing --------------------------------------------------------

// The Step 1 ticket renderer emits a centred "TABLE x" line. The poll payload
// only carries `payload_text`, so the kiosk reads the table token back out of
// it for the on-screen "now printing" number and the session log.
export function extractTableNumber(payloadText: string): string {
  for (const line of payloadText.split("\n")) {
    const match = line.trim().match(/^TABLE\s+(.+)$/i);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return "—";
}

// --- In-session log buffer -------------------------------------------------

export type KioskLogEntry = {
  jobId: string;
  table: string;
  payloadText: string;
  at: number;
  outcome: "printed" | "failed";
};

// Newest first; caps at `cap`, evicting the oldest. In-memory only — the log
// resets when the kiosk tab is closed.
export function appendLog(
  log: KioskLogEntry[],
  entry: KioskLogEntry,
  cap = LOG_CAP,
): KioskLogEntry[] {
  const next = [entry, ...log];
  return next.length > cap ? next.slice(0, cap) : next;
}

// --- Sequential print pipeline ---------------------------------------------

export type PrintJobDeps = {
  renderPayload: (text: string) => void;
  triggerPrint: () => void;
  awaitPrintComplete: () => Promise<void>;
  reportPrinted: (jobId: string) => Promise<void>;
  reportFailed: (jobId: string, error: string) => Promise<void>;
};

export type PrintOutcome =
  | { jobId: string; status: "printed" }
  | { jobId: string; status: "failed"; error: string };

export async function processPrintJob(
  job: PrintJob,
  deps: PrintJobDeps,
): Promise<PrintOutcome> {
  try {
    deps.renderPayload(job.payload_text);
    try {
      deps.triggerPrint();
    } catch {
      throw new Error("print api threw");
    }
    await deps.awaitPrintComplete();
    await deps.reportPrinted(job.id);
    return { jobId: job.id, status: "printed" };
  } catch (err) {
    const error =
      err instanceof Error && err.message
        ? err.message
        : "erreur d'impression";
    try {
      await deps.reportFailed(job.id, error);
    } catch {
      // Offline — the server keeps the job pending and we retry next poll.
    }
    return { jobId: job.id, status: "failed", error };
  }
}

// Jobs in a poll batch are printed strictly one at a time: each job's print +
// report fully resolves before the next job starts. Concurrent prints would
// interleave on the thermal printer and break ticket order.
export async function processBatch(
  jobs: PrintJob[],
  deps: PrintJobDeps,
  onJobStart?: (job: PrintJob) => void,
): Promise<PrintOutcome[]> {
  const outcomes: PrintOutcome[] = [];
  for (const job of jobs) {
    onJobStart?.(job);
    outcomes.push(await processPrintJob(job, deps));
  }
  return outcomes;
}

// Trailing run of consecutive failures in a batch — feeds the red-on-3-failures
// rule in `computeHealth`.
export function trailingFailureStreak(outcomes: PrintOutcome[]): number {
  let streak = 0;
  for (const outcome of outcomes) {
    if (outcome.status === "failed") streak += 1;
    else streak = 0;
  }
  return streak;
}

// --- Elapsed-time copy -----------------------------------------------------

// Second-granular "last poll" copy for the idle screen. `formatElapsedFr` from
// the kitchen view only resolves to whole minutes, which is too coarse for a
// 4-second poll cadence.
export function formatPollAgeFr(ageMs: number): string {
  if (!Number.isFinite(ageMs) || ageMs < 3_000) return "à l'instant";
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `il y a ${hours} h`;
}
