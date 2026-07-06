"use client";

import { useEffect, useState } from "react";
import { Logo } from "@pms/ui";

/**
 * Branded boot screen shown while the client hydrates. In the installed
 * app (display-mode: standalone — the TWA/PWA) it holds for a beat so the
 * opening reads as an intro; in a normal browser tab it only covers the
 * actual hydration wait, then gets out of the way.
 */
export function AppSplash({ ready }: { ready: boolean }) {
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches;
    const hold = setTimeout(() => setFading(true), standalone ? 1200 : 0);
    return () => clearTimeout(hold);
  }, [ready]);

  useEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => setGone(true), 450);
    return () => clearTimeout(t);
  }, [fading]);

  if (gone) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[var(--color-sidebar)] transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1 }}
      aria-hidden
    >
      {/* glow orbs */}
      <div
        className="animate-float-slow pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full opacity-40 blur-[100px]"
        style={{ background: "var(--gradient-brand)" }}
      />
      <div className="animate-float-slower pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-violet-600 opacity-30 blur-[100px]" />

      {/* 3D grid floor rushing toward the viewer */}
      <div
        className="animate-grid-fly pointer-events-none absolute inset-x-[-20%] bottom-0 h-[55%] opacity-50 [mask-image:linear-gradient(to_top,black,transparent_90%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(129,140,248,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(129,140,248,0.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          transform: "perspective(420px) rotateX(64deg)",
          transformOrigin: "bottom",
        }}
      />
      {/* horizon glow where the grid meets the sky */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[52%] h-24 opacity-40 blur-2xl"
        style={{ background: "var(--gradient-brand)" }}
      />

      <div className="relative flex flex-col items-center">
        <div className="animate-splash-logo">
          <Logo size="lg" showText={false} />
        </div>
        <p className="animate-splash-text mt-5 text-xl font-bold tracking-tight text-white">
          PMS
        </p>
        <p className="animate-splash-text text-xs font-medium tracking-widest text-white/40">
          THE PLACEMENT OS
        </p>
        <div className="animate-splash-text mt-6 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="animate-splash-dot h-1.5 w-1.5 rounded-full bg-brand-400"
              style={{ animationDelay: `${i * 180}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
