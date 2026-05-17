type TimestampedRecord = {
  server_received_at?: string | null;
  updated_at?: string | null;
};

export function serverTimestampWins<T extends TimestampedRecord>(
  local: T,
  remote: T,
): T {
  const localTimestamp = Date.parse(
    local.server_received_at ?? local.updated_at ?? "",
  );
  const remoteTimestamp = Date.parse(
    remote.server_received_at ?? remote.updated_at ?? "",
  );

  if (Number.isNaN(localTimestamp)) {
    return remote;
  }

  if (Number.isNaN(remoteTimestamp)) {
    return local;
  }

  return remoteTimestamp >= localTimestamp ? remote : local;
}
