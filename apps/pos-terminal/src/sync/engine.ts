import { synchronize } from "@nozbe/watermelondb/sync";
import { Q } from "@nozbe/watermelondb";
import { database } from "../db";
import { BusinessModel, OutboxModel, StaffMemberModel, SyncMetadataModel } from "../db/models";
import { apiClient } from "../api/client";
import { useBusinessStore } from "../stores/business-store";

type PullResponse = {
  changes: Record<string, unknown>;
  timestamp: string;
};

type SyncTableChanges = {
  created?: unknown[];
  updated?: unknown[];
  deleted?: string[];
};

export async function syncWithServer(): Promise<void> {
  const client = apiClient();
  let lastPulledAtIso: string | null = null;
  let pushedOutboxIds: string[] = [];

  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const since = lastPulledAt ? new Date(lastPulledAt).toISOString() : undefined;
      const response = await client.GET("/v1/sync/pull", {
        params: { query: since ? { since } : {} },
      });

      if (response.error) {
        throw new Error("Sync pull failed");
      }

      const data = response.data as PullResponse;
      lastPulledAtIso = data.timestamp;
      return {
        changes: data.changes,
        timestamp: Date.parse(data.timestamp),
      };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      const queuedAuditLogs = await readQueuedAuditLogCreates();
      pushedOutboxIds = queuedAuditLogs.map((entry) => entry.id);
      const pushPayload = mergeAuditLogOutboxChanges(
        changes as Record<string, SyncTableChanges>,
        queuedAuditLogs.map((entry) => entry.payload),
      );

      const response = await client.POST("/v1/sync/push", {
        body: {
          changes: pushPayload,
          lastPulledAt: lastPulledAt
            ? new Date(lastPulledAt).toISOString()
            : new Date(0).toISOString(),
        },
      });

      if (response.error) {
        throw new Error("Sync push failed");
      }
    },
  });

  await refreshCachedShellState();
  if (lastPulledAtIso) {
    await writeSyncMetadata("last_pulled_at", lastPulledAtIso);
  }
  await writeSyncMetadata("last_pushed_at", new Date().toISOString());
  await clearPushedOutboxRows(pushedOutboxIds);
}

async function readQueuedAuditLogCreates(): Promise<Array<{ id: string; payload: unknown }>> {
  const rows = await database
    .get<OutboxModel>("outbox")
    .query(Q.where("entity_type", "audit_log"), Q.where("operation", "create"))
    .fetch();

  return rows.map((row) => ({
    id: row.id,
    payload: JSON.parse(rawString(rawValue(row, "payload_json")) ?? "{}"),
  }));
}

function mergeAuditLogOutboxChanges(
  changes: Record<string, SyncTableChanges>,
  queuedAuditLogs: unknown[],
): Record<string, SyncTableChanges> {
  if (queuedAuditLogs.length === 0) {
    return changes;
  }

  const auditLog = changes.audit_log ?? { created: [], updated: [], deleted: [] };
  return {
    ...changes,
    audit_log: {
      created: [...(auditLog.created ?? []), ...queuedAuditLogs],
      updated: auditLog.updated ?? [],
      deleted: auditLog.deleted ?? [],
    },
  };
}

async function clearPushedOutboxRows(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const rows = await database.get<OutboxModel>("outbox").query(Q.where("id", Q.oneOf(ids))).fetch();
  await database.write(async () => {
    await Promise.all(rows.map((row) => row.destroyPermanently()));
  });
}

async function refreshCachedShellState(): Promise<void> {
  const [business] = await database
    .get<BusinessModel>("businesses")
    .query()
    .fetch();
  const [staff] = await database
    .get<StaffMemberModel>("staff_members")
    .query()
    .fetch();
  const outboxCount = await database.get<OutboxModel>("outbox").query().fetchCount();

  useBusinessStore.getState().setBusinessName(rawString(rawValue(business, "name")));
  useBusinessStore.getState().setStaffDisplayName(rawString(rawValue(staff, "display_name")));

  const { useSyncStore } = await import("../stores/sync-store");
  useSyncStore.getState().setOutboxCount(outboxCount);
}

async function writeSyncMetadata(key: string, value: string): Promise<void> {
  const collection = database.get<SyncMetadataModel>("sync_metadata");
  await database.write(async () => {
    const [existing] = await collection.query(Q.where("key", key)).fetch();
    if (existing) {
      await existing.update((record) => {
        setRawValue(record, "value", value);
      });
      return;
    }

    await collection.create((record) => {
      record._raw.id = key;
      setRawValue(record, "key", key);
      setRawValue(record, "value", value);
    });
  });
}

function rawString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function rawValue(record: { _raw: object } | undefined, key: string): unknown {
  return record ? (record._raw as Record<string, unknown>)[key] : undefined;
}

function setRawValue(record: { _raw: object }, key: string, value: unknown): void {
  (record._raw as Record<string, unknown>)[key] = value;
}
