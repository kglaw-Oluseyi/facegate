"use client";

import { useEffect } from "react";

export function KioskAllowState({
  allowCopy,
  displayName,
  gateName,
  resetAfterMs,
  onDone,
}: {
  allowCopy: string;
  displayName?: string;
  gateName: string;
  resetAfterMs: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDone, resetAfterMs);
    return () => window.clearTimeout(t);
  }, [onDone, resetAfterMs]);

  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#0A1F0A] px-8 pb-16 pt-12 transition-colors duration-300">
      <div className="animate-in fade-in duration-300 flex flex-col items-center gap-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-emerald-500/50 bg-emerald-950/40">
          <svg
            viewBox="0 0 24 24"
            className="h-14 w-14 text-fg-gold"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <div className="space-y-3">
          <p className="max-w-lg text-2xl font-medium leading-snug text-fg-ink">{allowCopy}</p>
          {displayName ? (
            <p className="text-3xl font-semibold tracking-tight text-fg-gold">{displayName}</p>
          ) : null}
        </div>
        <p className="text-sm text-fg-mist">{gateName}</p>
      </div>
    </div>
  );
}
