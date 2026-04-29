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
    <div className="flex h-full flex-col items-center justify-between px-6 pb-10 pt-12">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm font-medium tracking-[0.2em] text-fg-gold/90">{eventName}</p>
        <p className="text-xs text-fg-mist">{gateName}</p>
      </div>

      <div className="relative flex w-full max-w-2xl flex-1 flex-col items-center justify-center">
        <div className="relative aspect-[4/3] w-full max-h-[55vh] overflow-hidden rounded-[50%] border border-fg-line/60 bg-black shadow-[0_0_80px_rgba(201,168,76,0.08)]">
          <div className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] border-2 border-fg-gold/25 shadow-[inset_0_0_40px_rgba(0,0,0,0.45)] [animation-duration:3s] animate-[pulse_3s_ease-in-out_infinite]" />
          {videoSlot}
        </div>
      </div>

      <p className="text-center text-xl font-medium tracking-tight text-fg-ink">
        Please look at the camera
      </p>
    </div>
  );
}
