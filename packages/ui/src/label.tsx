import * as React from "react";
import { cn } from "./cn";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("mb-1.5 block text-sm font-medium text-neutral-700", className)}
    {...props}
  />
));
Label.displayName = "Label";
