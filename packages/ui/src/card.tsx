import * as React from "react";
import { cn } from "./cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--radius-xl)] border border-neutral-200/80 bg-white p-6 shadow-[var(--shadow-sm)]",
        interactive &&
          "card-hover-lift cursor-pointer hover:border-brand-200 hover:shadow-[var(--shadow-md)]",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";
