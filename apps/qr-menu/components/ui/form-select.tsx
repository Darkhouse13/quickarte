"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type FormSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type FormSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: FormSelectOption[];
  placeholder?: string;
  wrapperClassName?: string;
};

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  function FormSelect(
    {
      label,
      options,
      placeholder,
      className,
      wrapperClassName,
      id,
      defaultValue,
      value,
      ...rest
    },
    ref,
  ) {
    const inputId = id ?? rest.name;
    const isControlled = value !== undefined;
    return (
      <div className={wrapperClassName}>
        <label
          htmlFor={inputId}
          className="block font-mono text-[11px] uppercase tracking-widest text-ink mb-2"
        >
          {label}
        </label>
        <div className="relative group">
          <select
            ref={ref}
            id={inputId}
            {...(isControlled
              ? { value }
              : { defaultValue: defaultValue ?? (placeholder ? "" : undefined) })}
            className={cn(
              "appearance-none peer w-full bg-transparent border border-outline px-4 py-3.5 pr-12 font-sans text-base text-ink focus:outline-none focus:border-ink focus:bg-white transition-colors cursor-pointer",
              className,
            )}
            {...rest}
          >
            {placeholder ? (
              <option value="" disabled className="text-ink/30">
                {placeholder}
              </option>
            ) : null}
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
              >
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-ink peer-focus:text-accent transition-colors">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
              strokeLinejoin="miter"
            >
              <polyline points="2 4 6 8 10 4" />
            </svg>
          </div>
          <div className="absolute left-0 top-0 w-[3px] h-full bg-accent scale-y-0 peer-focus:scale-y-100 transition-transform origin-top pointer-events-none" />
        </div>
      </div>
    );
  },
);
