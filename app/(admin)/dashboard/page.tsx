import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { EventStatus, DeviceStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EventStatusBadge } from "@/components/admin/status-badge";
import { CalendarRange, Cpu, Sparkles, Users } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tenantId = session.user.tenantId;
  const todayStart = startOfDay(new Date());

  const [totalEvents, liveEvents, guestsToday, activeDevices] = await Promise.all([
    prisma.event.count({ where: { tenantId } }),
    prisma.event.count({ where: { tenantId, status: EventStatus.LIVE } }),
    prisma.guest.count({
      where: { createdAt: { gte: todayStart }, event: { tenantId } },
    }),
    prisma.gateDevice.count({
      where: { status: DeviceStatus.ACTIVE, gate: { event: { tenantId } } },
    }),
  ]);

  const events = await prisma.event.findMany({
    where: { tenantId },
    orderBy: { updatedAt: "desc" },
    take: 8,
    include: {
      gates: {
        include: {
          _count: { select: { devices: true } },
        },
      },
    },
  });

  const eventIds = events.map((e) => e.id);
  const [attemptMax, deviceMax] =
    eventIds.length > 0
      ? await Promise.all([
          prisma.reentryAttempt.groupBy({
            by: ["eventId"],
            where: { eventId: { in: eventIds } },
            _max: { attemptedAt: true },
          }),
          prisma.gateDevice.groupBy({
            by: ["eventId"],
            where: { eventId: { in: eventIds } },
            _max: { lastSeenAt: true },
          }),
        ])
      : [[], []];

  const attemptMap = new Map(
    attemptMax.map((a) => [a.eventId, a._max.attemptedAt])
  );
  const deviceMap = new Map(
    deviceMax.map((d) => [d.eventId, d._max.lastSeenAt])
  );

  function lastActivityAt(eventId: string, updatedAt: Date): Date {
    const a = attemptMap.get(eventId)?.getTime() ?? 0;
    const b = deviceMap.get(eventId)?.getTime() ?? 0;
    return new Date(Math.max(updatedAt.getTime(), a, b));
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-fg-line bg-fg-surface">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-fg-mist">Total Events</CardTitle>
            <CalendarRange className="h-4 w-4 text-fg-gold-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-fg-ink">{totalEvents}</div>
          </CardContent>
        </Card>
        <Card className="border-fg-line bg-fg-surface">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-fg-mist">Live Events</CardTitle>
            <Sparkles className="h-4 w-4 text-fg-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-fg-ink">{liveEvents}</div>
          </CardContent>
        </Card>
        <Card className="border-fg-line bg-fg-surface">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-fg-mist">Guests Today</CardTitle>
            <Users className="h-4 w-4 text-fg-success-text" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-fg-ink">{guestsToday}</div>
          </CardContent>
        </Card>
        <Card className="border-fg-line bg-fg-surface">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-fg-mist">Active Devices</CardTitle>
            <Cpu className="h-4 w-4 text-fg-ready-text" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-fg-ink">{activeDevices}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-ink">Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-fg-mist">
              <CalendarRange className="h-10 w-10 opacity-40" />
              <p className="text-sm">No events yet. Create one from the Events page.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-fg-line hover:bg-transparent">
                  <TableHead className="text-fg-mist">Name</TableHead>
                  <TableHead className="text-fg-mist">Status</TableHead>
                  <TableHead className="text-fg-mist">Gates</TableHead>
                  <TableHead className="text-fg-mist">Devices</TableHead>
                  <TableHead className="text-fg-mist">Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => {
                  const gateCount = event.gates.length;
                  const deviceCount = event.gates.reduce(
                    (acc, g) => acc + g._count.devices,
                    0
                  );
                  const last = lastActivityAt(event.id, event.updatedAt);
                  return (
                    <TableRow key={event.id} className="border-fg-line">
                      <TableCell>
                        <Link
                          href={`/events/${event.id}`}
                          className="font-medium text-fg-ink hover:text-fg-gold"
                        >
                          {event.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <EventStatusBadge status={event.status} />
                      </TableCell>
                      <TableCell className="text-fg-mist">{gateCount}</TableCell>
                      <TableCell className="text-fg-mist">{deviceCount}</TableCell>
                      <TableCell className="text-fg-mist">
                        {formatDistanceToNow(last, { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
