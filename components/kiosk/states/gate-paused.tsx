"use client";

export function KioskGatePausedState({
  eventName,
  gateName,
}: {
  eventName: string;
  gateName: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-8">
      <div className="animate-in fade-in duration-300 flex flex-col items-center gap-3 text-center">
        <p className="text-xs tracking-[0.18em] text-fg-gold/75">{eventName}</p>
        <p className="text-xs text-fg-mist">{gateName}</p>
        <p className="max-w-md pt-4 text-xl font-medium text-fg-ink">This gate is paused.</p>
        <p className="text-sm text-fg-mist">Please wait — activation is controlled by your event team.</p>
      </div>
    </div>
  );
}
