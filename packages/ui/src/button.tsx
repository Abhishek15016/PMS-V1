import * as React from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--gradient-brand)] text-white shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-glow-brand)] hover:brightness-[1.06] focus-visible:outline-brand-600",
  secondary:
    "bg-white text-neutral-900 border border-neutral-200 shadow-[var(--shadow-xs)] hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-brand-600",
  ghost: "bg-transparent text-neutral-700 hover:bg-neutral-100 focus-visible:outline-brand-600",
  danger:
    "bg-white text-[var(--color-danger)] border border-red-200 hover:bg-red-50 focus-visible:outline-[var(--color-danger)]",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium",
        "transition-all duration-150 ease-out active:scale-[0.98]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
