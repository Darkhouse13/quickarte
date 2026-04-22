import { formatAmountCompact } from "@/lib/utils/currency";
import { formatDeltaFR } from "@/lib/analytics/format";
import type { AnalyticsRange, AnalyticsSummary } from "@/lib/analytics/types";

type SummaryLineProps = {
  summary: AnalyticsSummary;
  range: AnalyticsRange;
};

function rangePhrase(range: AnalyticsRange): string {
  return range === "7d" ? "Ces 7 derniers jours" : "Ces 30 derniers jours";
}

export function SummaryLine({ summary, range }: SummaryLineProps) {
  const { revenue, orderCount, revenueDeltaPct, bestDayOfWeek } = summary;
  const prefix = rangePhrase(range);
  const revenueLabel = `${formatAmountCompact(revenue)} €`;

  let sentence: string;
  if (revenueDeltaPct !== null) {
    const deltaStr = formatDeltaFR(revenueDeltaPct);
    const dayClause = bestDayOfWeek
      ? ` Votre meilleur jour : ${bestDayOfWeek}.`
      : "";
    sentence = `${prefix} : ${revenueLabel} de revenus, ${deltaStr} par rapport à la période précédente.${dayClause}`;
  } else {
    sentence = `${prefix} : ${revenueLabel} de revenus sur ${orderCount} commande${orderCount > 1 ? "s" : ""}.`;
  }

  return (
    <div className="mx-6 my-6 border border-outline px-4 py-3 bg-base">
      <p className="font-mono text-[13px] text-ink/60 leading-[1.7]">
        {sentence}
      </p>
    </div>
  );
}
