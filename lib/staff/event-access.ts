import type { StaffRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function assertStaffEventAccess(input: {
  eventId: string;
  staffUserId: string;
  tenantId: string;
  role: StaffRole;
}) {
  const event = await prisma.event.findFirst({
    where: { id: input.eventId, tenantId: input.tenantId },
  });
  if (!event) {
    return { ok: false as const, status: 404 as const, message: "Event not found" };
  }

  if (input.role === "PLATFORM_ADMIN") {
    return { ok: true as const, event };
  }

  const perm = await prisma.eventStaffPermission.findUnique({
    where: {
      eventId_staffUserId: {
        eventId: input.eventId,
        staffUserId: input.staffUserId,
      },
    },
  });

  if (!perm) {
    return { ok: false as const, status: 403 as const, message: "No permission for this event" };
  }

  return { ok: true as const, event };
}
