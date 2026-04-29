export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { canAdminWrite } from "@/lib/roles";
import { createGateBody } from "@/lib/validators/admin";

export async function POST(
  req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);
  if (!canAdminWrite(session)) return jsonErr("Forbidden", 403);

  const { eventId } = await context.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: session.user.tenantId },
  });
  if (!event) return jsonErr("Event not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON");
  }

  const parsed = createGateBody.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg = Object.values(first).flat()[0] ?? "Validation failed";
    return jsonErr(msg);
  }

  const code = parsed.data.code.toUpperCase();

  try {
    const gate = await prisma.gate.create({
      data: {
        eventId: event.id,
        name: parsed.data.name,
        code,
        gateType: parsed.data.gateType,
      },
    });

    await writeAudit({
      tenantId: session.user.tenantId,
      eventId: event.id,
      staffUserId: session.user.id,
      action: "GATE_CREATED",
      metadata: { gateId: gate.id, code: gate.code },
    });

    return jsonOk({ gate });
  } catch (e) {
    const codeP = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    if (codeP === "P2002") {
      return jsonErr("A gate with this code already exists for this event");
    }
    console.error(e);
    return jsonErr("Could not create gate", 500);
  }
}
