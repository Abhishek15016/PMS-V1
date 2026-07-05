import * as React from "react";
import { cn } from "./cn";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "neutral" | "brand";
  className?: string;
}

export function StatCard({ label, value, icon, hint, tone = "neutral", className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
        {icon && (
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)]",
              tone === "brand" ? "bg-brand-50 text-brand-600" : "bg-neutral-100 text-neutral-500",
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{value}</p>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </div>
  );
}
