import * as React from "react";
import { cn } from "./cn";

/** Per the design system: skeleton loaders, never spinners, on async. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-[var(--radius-sm)] bg-neutral-200", className)}
      {...props}
    />
  );
}
