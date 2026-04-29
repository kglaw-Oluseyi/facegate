import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EventCommandCentre } from "@/components/admin/event-command-centre";
import { resolveKioskConfig } from "@/lib/kiosk-config";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: session.user.tenantId },
  });
  if (!event) notFound();

  const gates = await prisma.gate.findMany({
    where: { eventId: event.id },
    orderBy: { name: "asc" },
    include: {
      devices: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          devicePublicId: true,
          status: true,
          lastSeenAt: true,
        },
      },
    },
  });

  const initialGates = gates.map((g) => ({
    id: g.id,
    name: g.name,
    code: g.code,
    gateType: g.gateType,
    isActive: g.isActive,
    devices: g.devices.map((d) => ({
      id: d.id,
      devicePublicId: d.devicePublicId,
      status: d.status,
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    })),
  }));

  return (
    <EventCommandCentre
      eventId={event.id}
      initialEvent={{
        name: event.name,
        slug: event.slug,
        status: event.status,
        mode: event.mode,
        venueName: event.venueName,
        venueTimezone: event.venueTimezone,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
      }}
      initialGates={initialGates}
      initialKioskConfig={resolveKioskConfig(event.kioskConfig)}
    />
  );
}
