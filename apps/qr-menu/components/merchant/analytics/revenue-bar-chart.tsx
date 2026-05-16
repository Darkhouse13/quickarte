import { formatAmountCompact } from "@/lib/utils/currency";

type RevenueBarChartProps = {
  data: Array<{ label: string; value: number }>;
  highlightIndex: number;
  emptyLabel: string;
};

const HEIGHT = 180;
const TOP_PAD = 20;
const BOTTOM_PAD = 24;
const LEFT_PAD = 36;
const RIGHT_PAD = 8;
const PLOT_HEIGHT = HEIGHT - TOP_PAD - BOTTOM_PAD;

function niceMax(rawMax: number): number {
  if (rawMax <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const scaled = rawMax / mag;
  let niceScaled: number;
  if (scaled <= 1) niceScaled = 1;
  else if (scaled <= 2) niceScaled = 2;
  else if (scaled <= 5) niceScaled = 5;
  else niceScaled = 10;
  return niceScaled * mag;
}

export function RevenueBarChart({
  data,
  highlightIndex,
  emptyLabel,
}: RevenueBarChartProps) {
  const hasData = data.some((d) => d.value > 0);
  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center font-mono text-[12px] text-ink/50 border-y border-outline px-6"
        style={{ height: HEIGHT }}
      >
        {emptyLabel}
      </div>
    );
  }

  const rawMax = Math.max(...data.map((d) => d.value));
  const yMax = niceMax(rawMax);
  const n = data.length;
  const showEveryNth =
    n > 20 ? Math.ceil(n / 10) : n > 12 ? 2 : 1;

  const viewBoxWidth = 480;
  const plotWidth = viewBoxWidth - LEFT_PAD - RIGHT_PAD;
  const gap = n > 14 ? 2 : 4;
  const barW = (plotWidth - gap * (n - 1)) / n;
  const yTicks = [0, yMax / 2, yMax];

  return (
    <div className="border-y border-outline bg-base">
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        preserveAspectRatio="none"
        role="img"
        aria-label="Revenu par jour"
      >
        {yTicks.map((v, i) => {
          const y = TOP_PAD + PLOT_HEIGHT - (v / yMax) * PLOT_HEIGHT;
          return (
            <g key={`yt-${i}`}>
              <text
                x={LEFT_PAD - 6}
                y={y + 3}
                fontFamily="var(--font-mono)"
                fontSize="9"
                fill="var(--color-ink)"
                fillOpacity="0.4"
                textAnchor="end"
              >
                {formatAmountCompact(v)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const x = LEFT_PAD + i * (barW + gap);
          const h = yMax > 0 ? (d.value / yMax) * PLOT_HEIGHT : 0;
          const y = TOP_PAD + PLOT_HEIGHT - h;
          const isHighlight = i === highlightIndex && d.value > 0;
          const showLabel = i % showEveryNth === 0 || i === n - 1;
          return (
            <g key={`b-${i}`}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, d.value > 0 ? 1 : 0)}
                fill={
                  isHighlight ? "var(--color-accent)" : "var(--color-ink)"
                }
              />
              {showLabel ? (
                <text
                  x={x + barW / 2}
                  y={HEIGHT - 8}
                  fontFamily="var(--font-mono)"
                  fontSize="9"
                  fill="var(--color-ink)"
                  fillOpacity="0.5"
                  textAnchor="middle"
                >
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
