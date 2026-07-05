"use client";

import { useState } from "react";
import { cn } from "@pms/ui";

const SIZE_CLASSES = {
  sm: "h-7 w-7 rounded-md text-[10px]",
  md: "h-10 w-10 rounded-lg text-xs",
  lg: "h-14 w-14 rounded-xl text-base",
} as const;

const IMG_SIZE = { sm: 64, md: 128, lg: 128 } as const;

/** Deterministic soft background per company so fallback monograms don't all look identical. */
const FALLBACK_BGS = [
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

function domainOf(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    return new URL(website.startsWith("http") ? website : `https://${website}`).hostname;
  } catch {
    return null;
  }
}

function monogram(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return words.length >= 2 ? `${words[0]![0]}${words[1]![0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

export function CompanyLogo({
  name,
  website,
  size = "md",
  className,
}: {
  name: string;
  website?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const domain = domainOf(website);
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);

  if (!domain || failed) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center font-bold ring-1 ring-black/[0.06]",
          SIZE_CLASSES[size],
          FALLBACK_BGS[hash % FALLBACK_BGS.length],
          className,
        )}
        aria-hidden
      >
        {monogram(name)}
      </span>
    );
  }

  return (
    // Plain <img>, not next/image: the favicon service is an arbitrary remote
    // host and next/image would require whitelisting it in next.config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${IMG_SIZE[size]}`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 bg-white object-contain p-1 ring-1 ring-black/[0.06]",
        SIZE_CLASSES[size],
        className,
      )}
      aria-hidden
    />
  );
}
