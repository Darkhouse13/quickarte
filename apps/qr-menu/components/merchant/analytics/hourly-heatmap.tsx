import { dayOfWeekShortFR, hourLabel } from "@/lib/analytics/format";
import type { HeatmapCell } from "@/lib/analytics/types";

type HourlyHeatmapProps = {
  cells: HeatmapCell[];
  emptyLabel: string;
};

const HOUR_LABELS = [9, 12, 15, 18, 21];

export function HourlyHeatmap({ cells, emptyLabel }: HourlyHeatmapProps) {
  const total = cells.reduce((s, c) => s + c.orderCount, 0);
  if (total < 10) {
    return (
      <div className="px-6 py-10 text-center font-mono text-[12px] text-ink/50">
        {emptyLabel}
      </div>
    );
  }

  const max = Math.max(...cells.map((c) => c.orderCount));
  const byKey = new Map<string, number>();
  for (const c of cells) byKey.set(`${c.dayOfWeek}:${c.hour}`, c.orderCount);

  return (
    <div className="px-6 py-5">
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: "16px repeat(24, 1fr)" }}
      >
        {Array.from({ length: 7 }, (_, dow) => (
          <RowFor
            key={dow}
            dow={dow}
            max={max}
            get={(h) => byKey.get(`${dow}:${h}`) ?? 0}
          />
        ))}
        <div aria-hidden />
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={`hl-${h}`}
            className="font-mono text-[9px] text-ink/40 text-center pt-1"
          >
            {HOUR_LABELS.includes(h) ? hourLabel(h) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function RowFor({
  dow,
  max,
  get,
}: {
  dow: number;
  max: number;
  get: (h: number) => number;
}) {
  return (
    <>
      <div className="font-mono text-[9px] font-bold text-ink/60 pr-1 flex items-center">
        {dayOfWeekShortFR(dow)}
      </div>
      {Array.from({ length: 24 }, (_, h) => {
        const count = get(h);
        const isMax = count > 0 && count === max;
        const intensity = max > 0 ? count / max : 0;
        const style: React.CSSProperties = isMax
          ? { backgroundColor: "var(--color-accent)" }
          : count === 0
            ? { backgroundColor: "var(--color-outline)" }
            : {
                backgroundColor: "var(--color-ink)",
                opacity: 0.25 + 0.75 * intensity,
              };
        return (
          <div
            key={h}
            className="aspect-square w-full"
            style={style}
            title={`${dayOfWeekShortFR(dow)} ${hourLabel(h)} — ${count} commande${count > 1 ? "s" : ""}`}
          />
        );
      })}
    </>
  );
}
