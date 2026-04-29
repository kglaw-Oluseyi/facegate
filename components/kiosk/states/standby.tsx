"use client";

export function KioskStandbyState({ eventName }: { eventName: string }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-10 px-8">
      <div className="animate-in fade-in duration-300 flex flex-col items-center gap-6 text-center">
        <p className="text-3xl font-semibold tracking-[0.25em] text-fg-gold">FaceGate OS</p>
        <p className="text-lg text-fg-mist">{eventName}</p>
        <p className="text-xl font-medium text-fg-ink">Gates open soon.</p>
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
