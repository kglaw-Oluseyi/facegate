import type { ReactNode } from "react";

export default function KioskGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[#0A0A0A]">
      {children}
    </div>
  );
}
