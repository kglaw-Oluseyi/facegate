import {
  AdmissionState,
  Decision,
  EnrollmentStatus,
  GateType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type GateHealthDevice = {
  gateId: string;
  gateName: string;
  gateType: GateType;
  deviceId: string;
  devicePublicId: string;
  lastSeenAt: string | null;
  heartbeatAgeSeconds: number | null;
  status: "online" | "degraded" | "offline";
  allowCount: number;
  denyCount: number;
  errorCount: number;
};

export type LiveAttemptRow = {
  id: string;
  attemptedAt: string;
  gateName: string;
  decision: Decision;
  decisionReason: string;
  guestName: string | null;
  duplicateOfAttemptId: string | null;
};

export type LiveMetricsPayload = {
  checkedIn: number;
  enrolled: number;
  allowCount: number;
  denyCount: number;
  errorCount: number;
  uniqueReentered: number;
  activeDevices: number;
  gateHealth: GateHealthDevice[];
  attempts: LiveAttemptRow[];
};

function deviceConnStatus(lastSeenAt: Date | null): {
  heartbeatAgeSeconds: number | null;
  status: GateHealthDevice["status"];
} {
  if (!lastSeenAt) {
    return { heartbeatAgeSeconds: null, status: "offline" };
  }
  const sec = Math.floor((Date.now() - lastSeenAt.getTime()) / 1000);
  if (sec <= 90) return { heartbeatAgeSeconds: sec, status: "online" };
  if (sec <= 180) return { heartbeatAgeSeconds: sec, status: "degraded" };
  return { heartbeatAgeSeconds: sec, status: "offline" };
}

export async function computeLiveEventMetrics(
  eventId: string,
  tenantId: string
): Promise<LiveMetricsPayload | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
    select: { id: true },
  });
  if (!event) return null;

  const [
    checkedIn,
    enrolled,
    allowCount,
    denyCount,
    errorCount,
    uniqueReenteredRows,
    devices,
    attempts,
  ] = await Promise.all([
    prisma.guest.count({
      where: { eventId, admissionState: AdmissionState.CHECKED_IN },
    }),
    prisma.biometricEnrollment.count({
      where: { eventId, status: EnrollmentStatus.ACTIVE },
    }),
    prisma.reentryAttempt.count({
      where: { eventId, decision: Decision.ALLOW },
    }),
    prisma.reentryAttempt.count({
      where: { eventId, decision: Decision.DENY },
    }),
    prisma.reentryAttempt.count({
      where: { eventId, decision: Decision.ERROR },
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM (
        SELECT "matchedGuestId"
        FROM "ReentryAttempt"
        WHERE "eventId" = ${eventId}
          AND decision = 'ALLOW'
          AND "matchedGuestId" IS NOT NULL
        GROUP BY "matchedGuestId"
        HAVING COUNT(*) >= 2
      ) sub
    `,
    prisma.gateDevice.findMany({
      where: { eventId },
      include: {
        gate: { select: { id: true, name: true, gateType: true } },
      },
      orderBy: [{ gate: { name: "asc" } }, { createdAt: "asc" }],
    }),
    prisma.reentryAttempt.findMany({
      where: { eventId },
      orderBy: { attemptedAt: "desc" },
      take: 30,
      include: {
        gate: { select: { name: true } },
        matchedGuest: { select: { name: true, admissionState: true } },
      },
    }),
  ]);

  const gateDecisionBuckets = await prisma.reentryAttempt.groupBy({
    by: ["gateId", "decision"],
    where: { eventId },
    _count: { _all: true },
  });

  const countsByGate = new Map<
    string,
    { allow: number; deny: number; error: number }
  >();
  for (const row of gateDecisionBuckets) {
    const g = row.gateId;
    if (!countsByGate.has(g)) {
      countsByGate.set(g, { allow: 0, deny: 0, error: 0 });
    }
    const bucket = countsByGate.get(g)!;
    const c = row._count._all;
    if (row.decision === Decision.ALLOW) bucket.allow += c;
    else if (row.decision === Decision.DENY) bucket.deny += c;
    else if (row.decision === Decision.ERROR) bucket.error += c;
  }

  const activeDevices = devices.filter((d) => {
    if (!d.lastSeenAt) return false;
    const sec = (Date.now() - d.lastSeenAt.getTime()) / 1000;
    return sec <= 180;
  }).length;

  const gateHealth: GateHealthDevice[] = devices.map((d) => {
    const gc = countsByGate.get(d.gateId) ?? {
      allow: 0,
      deny: 0,
      error: 0,
    };
    const conn = deviceConnStatus(d.lastSeenAt);
    return {
      gateId: d.gate.id,
      gateName: d.gate.name,
      gateType: d.gate.gateType,
      deviceId: d.id,
      devicePublicId: d.devicePublicId,
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      heartbeatAgeSeconds: conn.heartbeatAgeSeconds,
      status: conn.status,
      allowCount: gc.allow,
      denyCount: gc.deny,
      errorCount: gc.error,
    };
  });

  const attemptRows: LiveAttemptRow[] = attempts.map((a) => ({
    id: a.id,
    attemptedAt: a.attemptedAt.toISOString(),
    gateName: a.gate.name,
    decision: a.decision,
    decisionReason: a.decisionReason,
    guestName: a.matchedGuest?.name ?? null,
    duplicateOfAttemptId: a.duplicateOfAttemptId,
  }));

  return {
    checkedIn,
    enrolled,
    allowCount,
    denyCount,
    errorCount,
    uniqueReentered: Number(uniqueReenteredRows[0]?.count ?? BigInt(0)),
    activeDevices,
    gateHealth,
    attempts: attemptRows,
  };
}
