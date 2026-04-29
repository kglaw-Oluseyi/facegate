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
    <div className="relative flex h-full flex-col items-center justify-center bg-[#051005] px-8 pb-16 pt-12 transition-colors duration-300">
      <div className="animate-in fade-in duration-300 flex flex-col items-center gap-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[color:var(--kiosk-accent)]/35 bg-black/20">
          <svg
            viewBox="0 0 100 100"
            className="h-14 w-14"
            fill="none"
            stroke="var(--kiosk-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M 20 50 L 40 70 L 80 30" />
          </svg>
        </div>
        <div className="space-y-3">
          <p className="font-display max-w-lg text-2xl font-medium leading-snug text-[color:var(--kiosk-text)]">
            {allowCopy}
          </p>
          {displayName ? (
            <p className="font-display text-[32px] font-medium tracking-[-0.01em] text-[color:var(--kiosk-text)]">
              {displayName}
            </p>
          ) : null}
        </div>
        <p className="text-[14px] tracking-wide text-fg-mist">{gateName}</p>
      </div>

      <div
        className="pointer-events-none fixed bottom-6 right-6 select-none font-display text-[11px] font-normal tracking-[0.15em]"
        style={{ color: "rgba(183,159,133,0.25)" }}
        aria-hidden
      >
        Maison Doclar
      </div>
    </div>
  );
}
