"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

type Choice = "individual" | "company";

export function ConnectBusinessTypePicker() {
  const [value, setValue] = useState<Choice>("individual");

  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-[11px] uppercase tracking-widest text-ink">
        Votre structure
      </span>
      <input type="hidden" name="businessType" value={value} />
      <div className="grid grid-cols-1 gap-0 border-2 border-ink">
        <Option
          active={value === "individual"}
          label="Entrepreneur individuel"
          sub="Auto-entrepreneur, profession libérale"
          onClick={() => setValue("individual")}
        />
        <Option
          active={value === "company"}
          label="Société"
          sub="SARL, SAS, EURL, SASU…"
          onClick={() => setValue("company")}
          bordered
        />
      </div>
    </div>
  );
}

function Option({
  active,
  label,
  sub,
  onClick,
  bordered,
}: {
  active: boolean;
  label: string;
  sub: string;
  onClick: () => void;
  bordered?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "py-4 px-5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/40 border-l-4",
        active
          ? "bg-ink text-base border-accent"
          : "bg-base text-ink hover:bg-black/[0.03] border-transparent",
        bordered && "border-t-2 border-t-ink",
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="font-mono font-bold uppercase tracking-widest text-[13px]">
          {label}
        </span>
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-widest",
            active ? "text-base/60" : "text-ink/40",
          )}
        >
          {sub}
        </span>
      </div>
    </button>
  );
}
