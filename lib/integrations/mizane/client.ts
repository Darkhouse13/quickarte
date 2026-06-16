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

type MizaneFetchOptions = RequestInit & { timeoutMs?: number };

async function mizaneFetch<T>(
  apiKey: string,
  path: string,
  options?: MizaneFetchOptions,
): Promise<{ data: T; status: number }> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options ?? {};
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

  // 409 = idempotent replay — identical 201 body, treat as success
  if (res.ok || res.status === 409) {
    return { data: (await res.json()) as T, status: res.status };
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
  return data;
}

export async function getMizaneMenu(apiKey: string): Promise<MizaneMenuResponse> {
  const { data } = await mizaneFetch<MizaneMenuResponse>(apiKey, "/menu", {
    timeoutMs: MENU_TIMEOUT_MS,
  });
  return data;
}

export async function postMizaneOrder(
  apiKey: string,
  req: MizaneOrderRequest,
): Promise<MizaneOrderResponse> {
  const { data } = await mizaneFetch<MizaneOrderResponse>(apiKey, "/orders", {
    method: "POST",
    body: JSON.stringify(req),
  });
  return data;
}

export async function getMizaneOrderStatus(
  apiKey: string,
  orderId: string,
): Promise<MizaneOrderStatusResponse> {
  const { data } = await mizaneFetch<MizaneOrderStatusResponse>(
    apiKey,
    `/orders/${orderId}`,
  );
  return data;
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
