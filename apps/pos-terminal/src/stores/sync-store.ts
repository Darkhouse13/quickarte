import { create } from "zustand";
import { syncWithServer } from "../sync/engine";

export type SyncStatus = "green" | "yellow" | "red";

type SyncState = {
  online: boolean;
  syncing: boolean;
  outboxCount: number;
  lastSyncedAt: number | null;
  status: SyncStatus;
  setOnline: (online: boolean) => void;
  setOutboxCount: (outboxCount: number) => void;
  runSync: () => Promise<void>;
};

export const useSyncStore = create<SyncState>((set, get) => ({
  online: true,
  syncing: false,
  outboxCount: 0,
  lastSyncedAt: null,
  status: "yellow",
  setOnline: (online) => set((state) => deriveStatus({ ...state, online })),
  setOutboxCount: (outboxCount) =>
    set((state) => deriveStatus({ ...state, outboxCount })),
  async runSync() {
    const state = get();
    if (!state.online || state.syncing) {
      set(deriveStatus(state));
      return;
    }

    set((current) => deriveStatus({ ...current, syncing: true }));
    try {
      await syncWithServer();
      set((current) =>
        deriveStatus({
          ...current,
          syncing: false,
          lastSyncedAt: Date.now(),
          outboxCount: 0,
        }),
      );
    } catch {
      set((current) => deriveStatus({ ...current, syncing: false, online: false }));
    }
  },
}));

function deriveStatus<T extends Omit<SyncState, "setOnline" | "setOutboxCount" | "runSync">>(
  state: T,
): T {
  const age = state.lastSyncedAt ? Date.now() - state.lastSyncedAt : Number.POSITIVE_INFINITY;
  const status: SyncStatus =
    !state.online || age > 5 * 60_000
      ? "red"
      : state.syncing || state.outboxCount > 0 || age > 60_000
        ? "yellow"
        : "green";

  return { ...state, status };
}
