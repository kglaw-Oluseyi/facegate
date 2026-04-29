import Link from "next/link";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { EventModeBadge } from "@/components/admin/mode-badge";
import { CalendarDays } from "lucide-react";

export default async function EventsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const events = await prisma.event.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { startsAt: "desc" },
    include: {
      _count: { select: { gates: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-fg-ink">Events</h2>
          <p className="text-sm text-fg-mist">Every event is an isolated biometric domain.</p>
        </div>
        <Button asChild className="bg-fg-gold text-fg-black hover:bg-fg-gold/90">
          <Link href="/events/new">Create Event</Link>
        </Button>
      </div>

      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-ink">All events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center text-fg-mist">
              <CalendarDays className="h-10 w-10 opacity-40" />
              <p className="text-sm">No events yet. Create your first event to begin provisioning gates.</p>
              <Button asChild className="mt-2 bg-fg-gold text-fg-black hover:bg-fg-gold/90">
                <Link href="/events/new">Create Event</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-fg-line hover:bg-transparent">
                  <TableHead className="text-fg-mist">Name</TableHead>
                  <TableHead className="text-fg-mist">Slug</TableHead>
                  <TableHead className="text-fg-mist">Venue</TableHead>
                  <TableHead className="text-fg-mist">Status</TableHead>
                  <TableHead className="text-fg-mist">Mode</TableHead>
                  <TableHead className="text-fg-mist">Starts</TableHead>
                  <TableHead className="text-fg-mist">Gates</TableHead>
                  <TableHead className="text-right text-fg-mist">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id} className="border-fg-line">
                    <TableCell className="font-medium text-fg-ink">{event.name}</TableCell>
                    <TableCell className="font-mono text-xs text-fg-mist">{event.slug}</TableCell>
                    <TableCell className="text-fg-mist">{event.venueName}</TableCell>
                    <TableCell>
                      <EventStatusBadge status={event.status} />
                    </TableCell>
                    <TableCell>
                      <EventModeBadge mode={event.mode} />
                    </TableCell>
                    <TableCell className="text-fg-mist">
                      {format(event.startsAt, "dd MMM yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-fg-mist">{event._count.gates}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm" className="border-fg-line">
                        <Link href={`/events/${event.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
