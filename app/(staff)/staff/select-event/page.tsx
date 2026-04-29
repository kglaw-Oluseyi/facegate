import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EventStatusBadge } from "@/components/admin/status-badge";
import { STAFF_EVENT_COOKIE } from "@/lib/staff/cookies";
import { EventStatus, StaffRole } from "@prisma/client";
import { selectStaffEvent } from "./actions";

export default async function SelectEventPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissions = await prisma.eventStaffPermission.findMany({
    where: { staffUserId: session.user.id },
    include: {
      event: {
        include: {
          _count: { select: { gates: true } },
        },
      },
    },
  });

  const events =
    session.user.role === StaffRole.PLATFORM_ADMIN
      ? await prisma.event.findMany({
          where: {
            tenantId: session.user.tenantId,
            status: { in: [EventStatus.READY, EventStatus.LIVE] },
          },
          include: { _count: { select: { gates: true } } },
        })
      : permissions
          .map((p) => p.event)
          .filter((e) => e.status === EventStatus.READY || e.status === EventStatus.LIVE);

  const cookieStore = await cookies();
  const existing = cookieStore.get(STAFF_EVENT_COOKIE)?.value;
  if (existing && events.some((e) => e.id === existing)) {
    redirect("/staff/guests");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg-ink">Select event</h1>
        <p className="text-sm text-fg-mist">
          Choose where you are operating. You can switch events later by returning{" "}
          <Link href="/staff/select-event" className="text-fg-gold hover:underline">
            here
          </Link>
          .
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {events.length === 0 ? (
          <p className="text-sm text-fg-mist">No READY or LIVE events assigned to you.</p>
        ) : (
          events.map((event) => (
            <Card key={event.id} className="border-fg-line bg-fg-surface">
              <CardHeader>
                <CardTitle className="text-fg-ink">{event.name}</CardTitle>
                <CardDescription className="text-fg-mist">{event.venueName}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <EventStatusBadge status={event.status} />
                  <span className="text-xs text-fg-mist">{event._count.gates} gates</span>
                </div>
                <form action={selectStaffEvent}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <Button
                    type="submit"
                    className="bg-fg-gold text-fg-black hover:bg-fg-gold/90"
                  >
                    Enter
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
