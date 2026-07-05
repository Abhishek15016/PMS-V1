import * as React from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "brand" | "info" | "success" | "warning" | "danger";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200",
  brand: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200",
  info: "bg-[var(--color-info)]/10 text-[var(--color-info)] ring-1 ring-inset ring-[var(--color-info)]/20",
  success: "bg-[var(--color-success)]/10 text-[var(--color-success)] ring-1 ring-inset ring-[var(--color-success)]/20",
  warning: "bg-[var(--color-warning)]/10 text-[var(--color-warning)] ring-1 ring-inset ring-[var(--color-warning)]/20",
  danger: "bg-[var(--color-danger)]/10 text-[var(--color-danger)] ring-1 ring-inset ring-[var(--color-danger)]/20",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-neutral-400",
  brand: "bg-brand-500",
  info: "bg-[var(--color-info)]",
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone = "neutral", dot = false, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[tone])} />}
      {children}
    </span>
  ),
);
Badge.displayName = "Badge";
