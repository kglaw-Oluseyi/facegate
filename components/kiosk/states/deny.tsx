"use client";

import { useEffect } from "react";

export function KioskDenyState({
  denyCopy,
  resetAfterMs,
  onDone,
}: {
  denyCopy: string;
  resetAfterMs: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDone, resetAfterMs);
    return () => window.clearTimeout(t);
  }, [onDone, resetAfterMs]);

  return (
    <div className="relative flex h-full flex-col items-center justify-center bg-[var(--kiosk-bg)] px-8">
      <div className="animate-in fade-in duration-300 flex max-w-lg flex-col items-center gap-6 text-center">
        <div className="text-fg-gold-muted">
          <svg viewBox="0 0 100 100" className="h-24 w-24" fill="none" aria-hidden>
            <path
              d="M 20 50 L 80 50"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.9"
            />
          </svg>
        </div>
        <p className="font-display text-2xl font-medium leading-snug text-[color:var(--kiosk-text)]">
          {denyCopy}
        </p>
        <p className="text-sm text-fg-mist">Please see our staff.</p>
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
