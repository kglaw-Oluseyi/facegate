"use client";

import type { ReactNode } from "react";

export function KioskIdleState({
  eventName,
  gateName,
  videoSlot,
}: {
  eventName: string;
  gateName: string;
  videoSlot: ReactNode;
}) {
  return (
    <div className="relative flex h-full flex-col items-center justify-between px-6 pb-10 pt-12">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-[10px] tracking-[0.2em] text-[color:var(--kiosk-text)]/30">
          {eventName}
        </p>
        <p className="text-xs text-fg-mist">{gateName}</p>
      </div>

      <div className="relative flex w-full max-w-2xl flex-1 flex-col items-center justify-center">
        <div className="relative aspect-[4/3] w-full max-h-[55vh] overflow-hidden rounded-[50%] border border-fg-line/60 bg-black shadow-[0_0_80px_rgba(183,159,133,0.08)]">
          <div
            className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] animate-[kiosk-ring-pulse_3s_ease-in-out_infinite]"
            style={{
              boxShadow: "0 0 0 2px rgba(183,159,133,0.15)",
            }}
          />
          {videoSlot}
        </div>
      </div>

      <p className="font-display text-center text-xs tracking-widest text-fg-gold-muted">
        Please look at the camera
      </p>

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
