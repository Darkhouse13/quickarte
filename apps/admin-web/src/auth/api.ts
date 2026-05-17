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
  return createClient(import.meta.env.VITE_API_BASE_URL ?? defaultBaseUrl, {
    fetch: fetchWithAuthRefresh,
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

async function fetchWithAuthRefresh(input: Request): Promise<Response> {
  const retryTemplate = input.clone();
  let response = await fetch(withAuthorization(input));

  if (response.status !== 401) {
    return response;
  }

  const problem = await readProblemResponse(response.clone());
  if (problem.type?.endsWith("/auth-token-expired")) {
    const refreshed = await useAuthStore.getState().refreshAccessToken();
    if (refreshed) {
      response = await fetch(withAuthorization(retryTemplate));
      return response;
    }
  }

  if (
    problem.type?.endsWith("/auth-token-expired") ||
    problem.type?.endsWith("/permissions-stale")
  ) {
    useAuthStore.getState().clear();
  }

  return response;
}

function withAuthorization(input: Request): Request {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(input.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return new Request(input, { headers });
}

async function readProblemResponse(response: Response): Promise<ProblemDetails> {
  try {
    return (await response.json()) as ProblemDetails;
  } catch {
    return {};
  }
}
