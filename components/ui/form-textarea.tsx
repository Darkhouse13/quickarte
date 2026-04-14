"use client";

import {
  forwardRef,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils/cn";

type FormTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: ReactNode;
  wrapperClassName?: string;
};

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  function FormTextarea(
    { label, hint, className, wrapperClassName, id, ...rest },
    ref,
  ) {
    const inputId = id ?? rest.name;
    return (
      <div className={wrapperClassName}>
        <div className="flex justify-between items-baseline mb-2">
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
        <div className="relative group">
          <textarea
            ref={ref}
            id={inputId}
            className={cn(
              "peer w-full bg-transparent border border-outline px-4 py-3.5 font-sans text-base text-ink placeholder:text-ink/30 focus:outline-none focus:border-ink focus:bg-white transition-colors resize-none",
              className,
            )}
            {...rest}
          />
          <div className="absolute left-0 top-0 w-[3px] h-full bg-accent scale-y-0 peer-focus:scale-y-100 transition-transform origin-top pointer-events-none" />
        </div>
      </div>
    );
  },
);
