export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { writeAudit } from "@/lib/audit";
import { canAdminWrite } from "@/lib/roles";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ eventId: string; gateId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);
  if (!canAdminWrite(session)) return jsonErr("Forbidden", 403);

  const { eventId, gateId } = await context.params;

  let body: { isActive?: boolean };
  try {
    body = (await req.json()) as { isActive?: boolean };
  } catch {
    return jsonErr("Invalid JSON");
  }

  if (typeof body.isActive !== "boolean") {
    return jsonErr("isActive boolean required");
  }

  const gate = await prisma.gate.findFirst({
    where: { id: gateId, eventId, event: { tenantId: session.user.tenantId } },
  });
  if (!gate) return jsonErr("Gate not found", 404);

  const updated = await prisma.gate.update({
    where: { id: gate.id },
    data: { isActive: body.isActive },
  });

  await writeAudit({
    tenantId: session.user.tenantId,
    eventId,
    staffUserId: session.user.id,
    actorType: "STAFF",
    actorId: session.user.id,
    action: body.isActive ? "GATE_RESUMED" : "GATE_PAUSED",
    metadata: { gateId: gate.id, gateCode: gate.code },
  });

  return jsonOk({ gate: updated });
}
