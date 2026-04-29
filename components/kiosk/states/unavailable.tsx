"use client";

export function KioskUnavailableState({
  eventName,
  gateName,
  unavailableCopy,
}: {
  eventName: string;
  gateName: string;
  unavailableCopy: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#0A0A0A] px-8 pb-12 pt-10">
      <div className="animate-in fade-in duration-300 flex w-full max-w-lg flex-col items-center gap-10 text-center">
        <div className="flex flex-col gap-1 text-center">
          <p className="text-xs tracking-[0.18em] text-fg-gold/70">{eventName}</p>
          <p className="text-xs text-fg-mist">{gateName}</p>
        </div>
        <div className="text-fg-gold/55">
          <svg viewBox="0 0 24 24" className="mx-auto h-20 w-20" fill="none" aria-hidden>
            <path
              d="M5 12.55a11 11 0 0 1 14.08 0"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M8.53 16.11a6 6 0 0 1 6.95 0"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M12 20h.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path d="M12 4v1M4 12H3m18 0h-1M12 20v-1" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
          </svg>
        </div>
        <p className="text-xl font-medium leading-snug text-fg-ink">{unavailableCopy}</p>
      </div>
    </div>
  );
}
