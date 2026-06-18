export function parseTableNumber(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 999) return null;
  return parsed;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// A dine-in table resolved from the storefront URL. A per-table Mizane QR
// carries `?t=<uuid>` (the authoritative Mizane tableId) and `?tl=<label>`; a
// legacy/manual QR carries `?table=<n>`. `label` is what the customer sees;
// `mizaneTableId` is what we forward to Mizane on the order.
export type TableContext = {
  mizaneTableId: string | null;
  label: string | null;
};

export function parseTableContext(params: {
  t?: string | string[];
  tl?: string | string[];
  table?: string | string[];
}): TableContext {
  const t = firstParam(params.t);
  if (t && UUID_RE.test(t)) {
    const rawLabel = firstParam(params.tl)?.trim();
    const label =
      rawLabel && rawLabel.length > 0 ? rawLabel.slice(0, 40) : null;
    return { mizaneTableId: t, label };
  }

  const legacy = parseTableNumber(params.table);
  return { mizaneTableId: null, label: legacy === null ? null : String(legacy) };
}
