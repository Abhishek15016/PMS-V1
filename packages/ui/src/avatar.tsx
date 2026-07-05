import * as React from "react";
import { cn } from "./cn";

const TONE_BG = [
  "bg-brand-100 text-brand-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
];

function hashTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return TONE_BG[Math.abs(hash) % TONE_BG.length]!;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
};

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ name, size = "md", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white/10",
        SIZE_CLASSES[size],
        hashTone(name),
        className,
      )}
      {...props}
    >
      {initials(name || "?")}
    </div>
  ),
);
Avatar.displayName = "Avatar";
