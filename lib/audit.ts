import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function writeAudit(input: {
  tenantId: string;
  eventId?: string | null;
  staffUserId?: string | null;
  action: string;
  metadata?: Prisma.InputJsonValue;
  actorType?: string;
  actorId?: string | null;
}) {
  await prisma.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      eventId: input.eventId ?? undefined,
      staffUserId: input.staffUserId ?? undefined,
      actorType: input.actorType ?? "STAFF",
      actorId: input.actorId ?? input.staffUserId ?? undefined,
      action: input.action,
      metadata: input.metadata ?? {},
    },
  });
}
