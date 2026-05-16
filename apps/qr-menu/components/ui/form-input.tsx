"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  suffix?: ReactNode;
  wrapperClassName?: string;
};

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput(
    { label, hint, suffix, className, wrapperClassName, id, type, ...rest },
    ref,
  ) {
    const inputId = id ?? rest.name;
    const isMono = type === "number";
    return (
      <div className={wrapperClassName}>
        <div
          className={cn(
            "flex justify-between items-baseline",
            hint ? "mb-2" : "mb-2",
          )}
        >
          <label
            htmlFor={inputId}
            className="block font-mono text-[11px] uppercase tracking-widest text-ink"
          >
            {label}
          </label>
          {hint ? (
            <span className="font-sans text-[11px] text-ink/40">{hint}</span>
          ) : null}
        </div>
        <div className="relative group flex items-center">
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cn(
              "peer w-full bg-transparent border border-outline px-4 py-3.5 text-base text-ink placeholder:text-ink/30 focus:outline-none focus:border-ink focus:bg-white transition-colors",
              isMono ? "font-mono pr-14" : "font-sans",
              className,
            )}
            {...rest}
          />
          {suffix ? (
            <span className="absolute right-4 font-mono text-[11px] font-bold text-ink/50 pointer-events-none peer-focus:text-ink transition-colors">
              {suffix}
            </span>
          ) : null}
          <div className="absolute left-0 top-0 w-[3px] h-full bg-accent scale-y-0 peer-focus:scale-y-100 transition-transform origin-top pointer-events-none" />
        </div>
      </div>
    );
  },
);
