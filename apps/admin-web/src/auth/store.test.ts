import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "./store";

describe("useAuthStore", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
    localStorage.clear();
    useAuthStore.getState().clear();
  });

  it("stores tokens and derives authenticated state", () => {
    useAuthStore.getState().setTokens({
      accessToken: tokenExpiringAt(Date.now() + 60_000),
      refreshToken: "refresh-token",
    });

    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    expect(localStorage.getItem("quickarte.admin.auth")).toContain("refresh-token");
  });

  it("clears persisted tokens", () => {
    useAuthStore.getState().setTokens({
      accessToken: tokenExpiringAt(Date.now() + 60_000),
      refreshToken: "refresh-token",
    });

    useAuthStore.getState().clear();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    expect(localStorage.getItem("quickarte.admin.auth")).toBeNull();
  });

  it("treats expired access tokens as unauthenticated", () => {
    useAuthStore.getState().setTokens({
      accessToken: tokenExpiringAt(Date.now() - 60_000),
      refreshToken: "refresh-token",
    });

    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });
});

function createLocalStorageMock(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => entries.delete(key),
    setItem: (key, value) => entries.set(key, value),
  };
}

function tokenExpiringAt(timestampMs: number): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: "user-1",
      business_id: "business-1",
      role_id: "role-1",
      exp: Math.floor(timestampMs / 1000),
    }),
  ).toString("base64url");

  return `header.${payload}.signature`;
}
