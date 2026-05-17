import { serverTimestampWins } from "./conflict";

describe("serverTimestampWins", () => {
  it("keeps the record with the newest server timestamp", () => {
    const local = { id: "local", server_received_at: "2026-05-17T10:00:00.000Z" };
    const remote = { id: "remote", server_received_at: "2026-05-17T10:01:00.000Z" };

    expect(serverTimestampWins(local, remote)).toBe(remote);
  });

  it("falls back to updated_at when server timestamp is missing", () => {
    const local = { id: "local", updated_at: "2026-05-17T10:02:00.000Z" };
    const remote = { id: "remote", updated_at: "2026-05-17T10:01:00.000Z" };

    expect(serverTimestampWins(local, remote)).toBe(local);
  });
});
