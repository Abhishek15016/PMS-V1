import * as React from "react";
import { cn } from "./cn";

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  /** Which side of the trigger the menu opens on — "top" for triggers pinned near the bottom of the viewport (e.g. a sidebar footer), so the menu isn't clipped. */
  side?: "top" | "bottom";
  className?: string;
}

/** Minimal click-outside/Escape-to-close menu — no portal, positioned relative to its trigger. */
export function DropdownMenu({
  trigger,
  children,
  align = "end",
  side = "bottom",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center">
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-40 min-w-[12rem] rounded-[var(--radius-lg)] border border-neutral-200/80 bg-white p-1.5 shadow-[var(--shadow-lg)]",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-brand-50 hover:text-brand-700",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("my-1 h-px bg-neutral-100", className)} />;
}
