import { create } from "zustand";
import { createClient } from "@quickarte/shared-types";

const STORAGE_KEY = "quickarte.admin.auth";

type TokenPayload = {
  sub?: string;
  business_id?: string;
  role_id?: string;
  exp?: number;
  iat?: number;
};

type LoginInput = {
  email: string;
  password: string;
  businessSlug: string;
};

type LoginResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "rate-limited"; retryAfterSeconds?: number };

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  businessId: string | null;
  roleId: string | null;
  issuedAt: number | null;
  loading: boolean;
  error: string | null;
  hydrate: () => void;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  login: (input: LoginInput) => Promise<LoginResult>;
  clear: () => void;
  isAuthenticated: () => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,
  businessId: null,
  roleId: null,
  issuedAt: null,
  loading: false,
  error: null,
  hydrate: () => {
    const stored = readStoredTokens();
    if (!stored) {
      return;
    }
    get().setTokens(stored);
  },
  setTokens: (tokens) => {
    const payload = decodeToken(tokens.accessToken);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      userId: payload?.sub ?? null,
      businessId: payload?.business_id ?? null,
      roleId: payload?.role_id ?? null,
      issuedAt: payload?.iat ?? null,
      error: null,
    });
  },
  login: async (input) => {
    set({ loading: true, error: null });
    const response = await createClient(apiBaseUrl()).POST("/v1/auth/owner/login", {
      body: input,
    });

    if (response.error) {
      const problem = readProblem(response.error);
      const retryAfterSeconds = problem.retry_after_seconds;
      const reason = problem.type?.endsWith("/rate-limit-exceeded")
        ? "rate-limited"
        : "invalid";
      set({ loading: false, error: reason });
      return { ok: false, reason, retryAfterSeconds };
    }

    if (!response.data) {
      set({ loading: false, error: "invalid" });
      return { ok: false, reason: "invalid" };
    }

    get().setTokens({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
    });
    set({ loading: false });
    return { ok: true };
  },
  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      accessToken: null,
      refreshToken: null,
      userId: null,
      businessId: null,
      roleId: null,
      issuedAt: null,
      loading: false,
      error: null,
    });
  },
  isAuthenticated: () => {
    const token = get().accessToken;
    const payload = token ? decodeToken(token) : null;
    return Boolean(payload?.exp && payload.exp * 1000 > Date.now());
  },
}));

function readStoredTokens(): { accessToken: string; refreshToken: string } | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<{ accessToken: string; refreshToken: string }>;
    if (typeof parsed.accessToken === "string" && typeof parsed.refreshToken === "string") {
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

function apiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/v1";
}

type ProblemDetails = {
  type?: string;
  retry_after_seconds?: number;
};

function readProblem(error: unknown): ProblemDetails {
  if (error && typeof error === "object") {
    return error as ProblemDetails;
  }
  return {};
}

function decodeToken(token: string): TokenPayload | null {
  const [, payload] = token.split(".");
  if (!payload) {
    return null;
  }
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as TokenPayload;
  } catch {
    return null;
  }
}
