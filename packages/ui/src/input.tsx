import * as React from "react";
import { cn } from "./cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-[var(--radius-md)] border border-neutral-300 bg-white px-3 text-sm text-neutral-900",
        "placeholder:text-neutral-400",
        "transition-all duration-150 ease-out",
        "hover:border-neutral-400",
        "focus-visible:border-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500/30 focus-visible:outline-offset-0",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
