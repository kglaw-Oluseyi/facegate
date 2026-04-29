import { EventStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { writeAudit } from "@/lib/audit";

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return jsonErr("Unauthorized", 401);
  }

  const now = new Date();

  const overdue = await prisma.event.findMany({
    where: {
      status: EventStatus.LIVE,
      endsAt: { lt: now },
    },
    select: { id: true, tenantId: true, name: true },
  });

  let closed = 0;

  for (const ev of overdue) {
    await prisma.event.update({
      where: { id: ev.id },
      data: { status: EventStatus.CLOSED },
    });

    await writeAudit({
      tenantId: ev.tenantId,
      eventId: ev.id,
      actorType: "SYSTEM",
      actorId: null,
      action: "EVENT_STATUS_CHANGED",
      metadata: {
        previousStatus: EventStatus.LIVE,
        newStatus: EventStatus.CLOSED,
        reason: "AUTO_CLOSE_PAST_END_TIME",
      },
    });

    closed += 1;
  }

  return jsonOk({ closed });
}
