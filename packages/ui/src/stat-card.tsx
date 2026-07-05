import * as React from "react";
import { cn } from "./cn";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  tone?: "neutral" | "brand";
  className?: string;
}

const TREND_CLASSES: Record<string, string> = {
  up: "text-[var(--color-success)] bg-[var(--color-success)]/10",
  down: "text-[var(--color-danger)] bg-[var(--color-danger)]/10",
  flat: "text-neutral-500 bg-neutral-100",
};

export function StatCard({ label, value, icon, hint, trend, tone = "neutral", className }: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[var(--radius-xl)] border border-neutral-200/80 bg-white p-5",
        "shadow-[var(--shadow-sm)] card-hover-lift hover:shadow-[var(--shadow-md)]",
        className,
      )}
    >
      {tone === "brand" && (
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-[0.08] blur-2xl"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden
        />
      )}
      <div className="relative flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
        {icon && (
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)]",
              tone === "brand"
                ? "bg-gradient-brand text-white shadow-[var(--shadow-sm)]"
                : "bg-neutral-100 text-neutral-500",
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <p
        className={cn(
          "relative mt-3 text-3xl font-bold tracking-tight",
          tone === "brand" ? "text-gradient-brand" : "text-neutral-900",
        )}
      >
        {value}
      </p>
      <div className="relative mt-2 flex items-center gap-2">
        {trend && (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
              TREND_CLASSES[trend.direction],
            )}
          >
            {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} {trend.value}
          </span>
        )}
        {hint && <span className="text-xs text-neutral-500">{hint}</span>}
      </div>
    </div>
  );
}
