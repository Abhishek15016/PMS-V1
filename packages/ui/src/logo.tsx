import * as React from "react";
import { cn } from "./cn";

export interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  textClassName?: string;
  className?: string;
}

const MARK_SIZE: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "h-7 w-7 rounded-[8px]",
  md: "h-9 w-9 rounded-[10px]",
  lg: "h-11 w-11 rounded-xl",
};

const ICON_SIZE: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

const TEXT_SIZE: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

/** Ascending trend mark — placement growth, not a static "P". Shared across sidebar, header, and auth screens for one consistent brand identity. */
export function Logo({ size = "md", showText = true, textClassName, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center shadow-[var(--shadow-glow-brand)] ring-1 ring-white/25",
          MARK_SIZE[size],
        )}
        style={{ background: "var(--gradient-brand)" }}
      >
        <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/30 via-white/0 to-transparent" />
        <svg viewBox="0 0 24 24" fill="none" className={cn("relative", ICON_SIZE[size])} aria-hidden>
          <path
            d="M3.5 17.5L9.5 11.5L13.5 15.5L20.5 7.5"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M15 7.5H20.5V13" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {showText && (
        <span className={cn("font-bold tracking-tight", TEXT_SIZE[size], textClassName)}>PMS</span>
      )}
    </div>
  );
}
