import { createClient } from "@quickarte/shared-types";
import { useAuthStore } from "./store";

const defaultBaseUrl = "http://localhost:3001/v1";

export type ProblemDetails = {
  type?: string;
  status?: number;
  detail?: string;
  retry_after_seconds?: number;
};

export function apiClient() {
  const token = useAuthStore.getState().accessToken;
  return createClient(import.meta.env.VITE_API_BASE_URL ?? defaultBaseUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export function publicApiClient() {
  return createClient(import.meta.env.VITE_API_BASE_URL ?? defaultBaseUrl);
}

export function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? defaultBaseUrl;
}

export function readProblem(error: unknown): ProblemDetails {
  if (error && typeof error === "object") {
    return error as ProblemDetails;
  }
  return {};
}
