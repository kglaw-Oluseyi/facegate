"use client";

import { useEffect } from "react";

export function KioskErrorState({
  errorCopy,
  resetAfterMs,
  onDone,
}: {
  errorCopy: string;
  resetAfterMs: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDone, resetAfterMs);
    return () => window.clearTimeout(t);
  }, [onDone, resetAfterMs]);

  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#0A0A0A] px-8">
      <div className="animate-in fade-in duration-300 flex max-w-lg flex-col items-center gap-10 text-center">
        <div className="text-fg-gold/65">
          <svg viewBox="0 0 24 24" className="h-24 w-24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
            <path
              d="M8 12h8M12 8v8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.85"
            />
          </svg>
        </div>
        <p className="text-2xl font-medium leading-snug text-fg-ink">{errorCopy}</p>
      </div>
    </div>
  );
}
