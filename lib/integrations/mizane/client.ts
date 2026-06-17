import type {
  MizaneApiError,
  MizaneMenuResponse,
  MizaneOrderRequest,
  MizaneOrderResponse,
  MizaneOrderStatusResponse,
  MizaneTable,
} from "./types";

const BASE_URL = "https://mizane.xyz/v1/integration";

// Default per-request timeout. Bounds how long a slow/dead Mizane can block the
// caller — critical because order POST runs inside customer checkout and the
// status poll runs on the garcon board's 3s refresh loop.
const DEFAULT_TIMEOUT_MS = 8_000;
// The full menu can be large; give it more room than transactional calls.
const MENU_TIMEOUT_MS = 20_000;

export class MizaneError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MizaneError";
  }
}

type MizaneFetchOptions = RequestInit & {
  timeoutMs?: number;
  // When true, a 304 Not Modified (paired with an If-None-Match request) is
  // returned as a normal result with data === null instead of throwing.
  allowNotModified?: boolean;
};

async function mizaneFetch<T>(
  apiKey: string,
  path: string,
  options?: MizaneFetchOptions,
): Promise<{ data: T | null; status: number; etag: string | null }> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, allowNotModified, ...init } =
    options ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    // Distinguish a deliberate timeout abort from a generic network failure so
    // callers/logs can tell "Mizane was slow" from "Mizane was unreachable".
    if (err instanceof Error && err.name === "AbortError") {
      throw new MizaneError(0, "timeout", `Mizane n'a pas répondu (timeout ${timeoutMs}ms).`);
    }
    throw new MizaneError(
      0,
      "network",
      err instanceof Error ? err.message : "Erreur réseau Mizane.",
    );
  } finally {
    clearTimeout(timer);
  }

  const etag = res.headers.get("etag");

  // 304 = the menu is unchanged since the cached ETag — empty body, not an error.
  if (allowNotModified && res.status === 304) {
    return { data: null, status: 304, etag };
  }

  // 409 = idempotent replay — identical 201 body, treat as success
  if (res.ok || res.status === 409) {
    return { data: (await res.json()) as T, status: res.status, etag };
  }

  const errBody = await res.json().catch(() => null) as MizaneApiError | null;
  throw new MizaneError(
    res.status,
    errBody?.error?.code ?? "unknown",
    errBody?.error?.message ?? res.statusText,
  );
}

export async function getMizaneTables(apiKey: string): Promise<MizaneTable[]> {
  const { data } = await mizaneFetch<MizaneTable[]>(apiKey, "/tables");
  return data!;
}

// Result of a conditional GET /menu. `notModified` means the cached ETag still
// matched (304) — the caller should keep its existing local menu untouched.
export type MizaneMenuFetch =
  | { notModified: false; menu: MizaneMenuResponse; etag: string | null }
  | { notModified: true; etag: string | null };

export async function getMizaneMenu(
  apiKey: string,
  etag?: string | null,
): Promise<MizaneMenuFetch> {
  const { data, status, etag: responseEtag } =
    await mizaneFetch<MizaneMenuResponse>(apiKey, "/menu", {
      timeoutMs: MENU_TIMEOUT_MS,
      allowNotModified: true,
      headers: etag ? { "If-None-Match": etag } : undefined,
    });

  if (status === 304) {
    // 304 echoes the ETag; fall back to the one we sent if it doesn't.
    return { notModified: true, etag: responseEtag ?? etag ?? null };
  }
  return { notModified: false, menu: data!, etag: responseEtag };
}

export async function postMizaneOrder(
  apiKey: string,
  req: MizaneOrderRequest,
): Promise<MizaneOrderResponse> {
  const { data } = await mizaneFetch<MizaneOrderResponse>(apiKey, "/orders", {
    method: "POST",
    body: JSON.stringify(req),
  });
  return data!;
}

export async function getMizaneOrderStatus(
  apiKey: string,
  orderId: string,
): Promise<MizaneOrderStatusResponse> {
  const { data } = await mizaneFetch<MizaneOrderStatusResponse>(
    apiKey,
    `/orders/${orderId}`,
  );
  return data!;
}

export async function testMizaneConnection(
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await getMizaneMenu(apiKey);
    return { ok: true };
  } catch (err) {
    if (err instanceof MizaneError) {
      // 401 = key rotated/invalid; surface a clear message
      if (err.status === 401) return { ok: false, error: "Clé API invalide ou révoquée." };
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "Impossible de joindre Mizane." };
  }
}
