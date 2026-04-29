import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StaffShell } from "@/components/staff/staff-shell";
import { STAFF_EVENT_COOKIE } from "@/lib/staff/cookies";
import { ThemeProvider } from "@/lib/theme-context";

export default async function StaffSectionLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const eventId = cookieStore.get(STAFF_EVENT_COOKIE)?.value ?? null;
  const event = eventId
    ? await prisma.event.findFirst({
        where: { id: eventId, tenantId: session.user.tenantId },
        select: { name: true },
      })
    : null;

  return (
    <ThemeProvider>
      <StaffShell eventName={event?.name ?? null}>{children}</StaffShell>
    </ThemeProvider>
  );
}
