import { DeviceStatus, EventStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function loadPlatformOverview() {
  const [tenantRows, liveEvents, providerPing] = await Promise.all([
    prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { events: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.event.findMany({
      where: { status: EventStatus.LIVE },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        tenant: { select: { name: true, slug: true } },
        _count: {
          select: {
            gates: true,
          },
        },
      },
      orderBy: { name: "asc" },
      take: 50,
    }),
    import("@/lib/biometric").then((m) =>
      m.getBiometricProvider().status().catch(() => ({
        ready: false,
        provider: "unknown",
      }))
    ),
  ]);

  const devicesAgg = await prisma.gateDevice.groupBy({
    by: ["eventId"],
    where: {
      lastSeenAt: {
        gte: new Date(Date.now() - 180_000),
      },
      status: DeviceStatus.ACTIVE,
    },
    _count: { _all: true },
  });

  const activeByEvent = new Map(
    devicesAgg.map((d) => [d.eventId, d._count._all])
  );

  return {
    tenants: tenantRows.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      createdAt: t.createdAt.toISOString(),
      eventCount: t._count.events,
    })),
    liveEvents: liveEvents.map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      status: e.status,
      tenantName: e.tenant.name,
      tenantSlug: e.tenant.slug,
      gateCount: e._count.gates,
      activeDevicesApprox: activeByEvent.get(e.id) ?? 0,
    })),
    biometricProvider: providerPing,
    dbOk: true as const,
  };
}
