import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { writeAudit } from "@/lib/audit";
import { canAdminWrite } from "@/lib/roles";

export async function POST(
  req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);
  if (!canAdminWrite(session)) return jsonErr("Forbidden", 403);

  const { eventId } = await context.params;

  let body: { active?: boolean };
  try {
    body = (await req.json()) as { active?: boolean };
  } catch {
    return jsonErr("Invalid JSON");
  }

  if (typeof body.active !== "boolean") {
    return jsonErr("active boolean required");
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: session.user.tenantId },
  });
  if (!event) return jsonErr("Event not found", 404);

  await prisma.gate.updateMany({
    where: { eventId: event.id },
    data: { isActive: body.active },
  });

  await writeAudit({
    tenantId: session.user.tenantId,
    eventId: event.id,
    staffUserId: session.user.id,
    actorType: "STAFF",
    actorId: session.user.id,
    action: body.active ? "GATE_RESUMED" : "GATE_PAUSED",
    metadata: { scope: "ALL_GATES", active: body.active },
  });

  return jsonOk({ updated: true, active: body.active });
}
