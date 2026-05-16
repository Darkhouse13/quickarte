import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type ActionCardProps = {
  label: string;
  href: string;
  badge?: string | number;
  accent?: "ink" | "accent";
  isLast?: boolean;
  className?: string;
};

export function ActionCard({
  label,
  href,
  badge,
  accent = "ink",
  isLast = false,
  className,
}: ActionCardProps) {
  const barColor = accent === "accent" ? "bg-accent" : "bg-ink";
  return (
    <Link
      href={href}
      className={cn(
        "p-6 flex items-center justify-between hover:bg-black/[0.02] transition-colors cursor-pointer group relative",
        !isLast && "border-b border-outline",
        className,
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 w-1 h-full scale-y-0 group-hover:scale-y-100 transition-transform origin-top",
          barColor,
        )}
      />
      <span className="font-bold text-[16px] tracking-tight">{label}</span>
      <div className="flex items-center gap-4">
        {badge !== undefined ? (
          <span className="bg-accent text-base text-[10px] font-mono px-2 py-0.5 font-bold">
            {badge}
          </span>
        ) : null}
        <span className="font-mono text-ink/30 group-hover:text-ink transition-colors text-lg">
          →
        </span>
      </div>
    </Link>
  );
}
