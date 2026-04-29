"use client";

export function KioskEnrollInviteState() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#0A0A0A] px-8">
      <div className="animate-in fade-in duration-300 max-w-lg text-center">
        <p className="text-2xl font-medium leading-snug text-fg-ink">
          Welcome. Step closer to register for re-entry.
        </p>
      </div>
    </div>
  );
}
