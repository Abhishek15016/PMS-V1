"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";
import { cn } from "@pms/ui";
import type { Role } from "@pms/types";
import { NAV_ITEMS } from "@/lib/navigation";
import { useLogout } from "@/lib/auth/use-logout";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  run: () => void;
}

export function CommandPalette({ role }: { role: Role | undefined }) {
  const router = useRouter();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(() => {
    const nav = NAV_ITEMS.filter((item) => !role || item.roles.includes(role)).map((item) => ({
      id: item.href,
      label: item.label,
      hint: "Page",
      icon: item.icon,
      keywords: [item.label.toLowerCase(), ...(item.keywords ?? [])],
      run: () => router.push(item.href),
    }));
    return [
      ...nav,
      {
        id: "logout",
        label: "Sign out",
        hint: "Account",
        icon: LogOut,
        keywords: ["logout", "sign out", "exit"],
        run: () => void logout(),
      },
    ];
    // useLogout returns a new closure each render; keying on it would rebuild
    // the list every keystroke for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.keywords.some((k) => k.includes(q)));
  }, [commands, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setActiveIndex(0);
      } else if (e.key === "Escape") {
        close();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-neutral-950/60 px-4 pt-[18vh] backdrop-blur-sm"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#12141c] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4">
          <Search className="h-4 w-4 shrink-0 text-white/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const cmd = filtered[activeIndex];
                if (cmd) {
                  close();
                  cmd.run();
                }
              }
            }}
            placeholder="Jump to a page or action…"
            className="h-12 w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
            aria-label="Search commands"
          />
          <kbd className="hidden shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/40 sm:block">
            ESC
          </kbd>
        </div>
        <ul ref={listRef} className="max-h-72 overflow-y-auto p-2" role="listbox">
          {filtered.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-white/35">No matches.</li>
          ) : (
            filtered.map((cmd, i) => {
              const Icon = cmd.icon;
              return (
                <li key={cmd.id} data-index={i} role="option" aria-selected={i === activeIndex}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => {
                      close();
                      cmd.run();
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      i === activeIndex ? "bg-white/[0.08] text-white" : "text-white/60",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-white/40" />
                    <span className="flex-1">{cmd.label}</span>
                    {cmd.hint && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-white/25">
                        {cmd.hint}
                      </span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
