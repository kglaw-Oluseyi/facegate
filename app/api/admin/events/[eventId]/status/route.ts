export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { canAdminWrite } from "@/lib/roles";
import { patchEventStatusBody } from "@/lib/validators/admin";
import { EventStatus } from "@prisma/client";

function isAllowedTransition(from: EventStatus, to: EventStatus): boolean {
  if (from === to) return true;
  const map: Record<EventStatus, EventStatus[]> = {
    DRAFT: [EventStatus.READY],
    READY: [EventStatus.LIVE],
    LIVE: [EventStatus.CLOSED],
    CLOSED: [EventStatus.ARCHIVED],
    ARCHIVED: [],
  };
  return map[from]?.includes(to) ?? false;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);
  if (!canAdminWrite(session)) return jsonErr("Forbidden", 403);

  const { eventId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON");
  }

  const parsed = patchEventStatusBody.safeParse(body);
  if (!parsed.success) {
    return jsonErr(parsed.error.flatten().formErrors.join(", ") || "Validation failed");
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: session.user.tenantId },
  });

  if (!event) return jsonErr("Event not found", 404);

  const nextStatus = parsed.data.status;
  if (event.status === nextStatus) {
    return jsonOk({ event });
  }
  if (!isAllowedTransition(event.status, nextStatus)) {
    return jsonErr(`Cannot change status from ${event.status} to ${nextStatus}`);
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { status: nextStatus },
  });

  await writeAudit({
    tenantId: session.user.tenantId,
    eventId: event.id,
    staffUserId: session.user.id,
    action: "EVENT_STATUS_CHANGED",
    metadata: { from: event.status, to: nextStatus },
  });

  return jsonOk({ event: updated });
}
