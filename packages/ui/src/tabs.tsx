import * as React from "react";
import { cn } from "./cn";

export interface TabItem {
  value: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 p-1 text-sm",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.value)}
            className={cn(
              "rounded-[var(--radius-sm)] px-3.5 py-1.5 font-medium transition-all duration-150",
              isActive
                ? "bg-white text-brand-700 shadow-[var(--shadow-xs)]"
                : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
