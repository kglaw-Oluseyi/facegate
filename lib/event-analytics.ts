import { Decision } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AnalyticsPayload = {
  hourlyAllows: { hour: string; count: number }[];
  decisionSplit: { decision: Decision; count: number }[];
  gateAllows: { gateId: string; gateName: string; count: number }[];
  throughput: { bucket: string; count: number }[];
};

export async function computeEventAnalytics(eventId: string): Promise<AnalyticsPayload> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startsAt: true, endsAt: true },
  });
  if (!event) {
    return {
      hourlyAllows: [],
      decisionSplit: [],
      gateAllows: [],
      throughput: [],
    };
  }

  const [hourlyAllows, decisionSplit, gateAllowsRaw, throughput] = await Promise.all([
    prisma.$queryRaw<{ hour: Date; count: bigint }[]>`
      SELECT date_trunc('hour', "attemptedAt") AS hour, COUNT(*)::bigint AS count
      FROM "ReentryAttempt"
      WHERE "eventId" = ${eventId}
        AND decision = 'ALLOW'
        AND "attemptedAt" >= ${event.startsAt}
        AND "attemptedAt" <= ${event.endsAt}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.reentryAttempt.groupBy({
      by: ["decision"],
      where: { eventId },
      _count: { _all: true },
    }),
    prisma.reentryAttempt.groupBy({
      by: ["gateId"],
      where: { eventId, decision: Decision.ALLOW },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ bucket: Date; count: bigint }[]>`
      SELECT to_timestamp(floor(extract(epoch from "attemptedAt") / 300) * 300) AS bucket,
             COUNT(*)::bigint AS count
      FROM "ReentryAttempt"
      WHERE "eventId" = ${eventId}
        AND "attemptedAt" >= ${event.startsAt}
        AND "attemptedAt" <= ${event.endsAt}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  const gates = await prisma.gate.findMany({
    where: { eventId },
    select: { id: true, name: true },
  });
  const gateName = new Map(gates.map((g) => [g.id, g.name]));

  const gateAllows = gateAllowsRaw
    .map((g) => ({
      gateId: g.gateId,
      gateName: gateName.get(g.gateId) ?? g.gateId,
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    hourlyAllows: hourlyAllows.map((row) => ({
      hour: row.hour.toISOString(),
      count: Number(row.count),
    })),
    decisionSplit: decisionSplit.map((d) => ({
      decision: d.decision,
      count: d._count._all,
    })),
    gateAllows,
    throughput: throughput.map((row) => ({
      bucket: row.bucket.toISOString(),
      count: Number(row.count),
    })),
  };
}
