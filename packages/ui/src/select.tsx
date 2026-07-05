import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full appearance-none rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 pl-3 pr-9 text-sm font-medium text-neutral-900",
          "transition-all duration-150 ease-out",
          "hover:border-brand-300 hover:bg-white",
          "focus-visible:border-brand-500 focus-visible:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500/30 focus-visible:outline-offset-0",
          "disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
        aria-hidden
      />
    </div>
  ),
);
Select.displayName = "Select";
