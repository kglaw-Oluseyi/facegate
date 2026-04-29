export const dynamic = "force-dynamic";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { DeviceStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { canAdminWrite } from "@/lib/roles";
import { createDeviceBody } from "@/lib/validators/admin";

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

  const parsed = createDeviceBody.safeParse(body);
  if (!parsed.success) {
    return jsonErr("Invalid gate selection");
  }

  const gate = await prisma.gate.findFirst({
    where: { id: parsed.data.gateId, eventId: event.id },
  });
  if (!gate) return jsonErr("Gate not found for this event", 404);

  const plaintextSecret = randomBytes(32).toString("hex");
  const deviceSecretHash = await bcrypt.hash(plaintextSecret, 12);

  const device = await prisma.gateDevice.create({
    data: {
      gateId: gate.id,
      eventId: event.id,
      deviceSecretHash,
      status: DeviceStatus.ACTIVE,
    },
  });

  await writeAudit({
    tenantId: session.user.tenantId,
    eventId: event.id,
    staffUserId: session.user.id,
    action: "DEVICE_PROVISIONED",
    metadata: { deviceId: device.id, gateId: gate.id, devicePublicId: device.devicePublicId },
  });

  return jsonOk({
    device: {
      id: device.id,
      devicePublicId: device.devicePublicId,
      gateId: gate.id,
      gateName: gate.name,
    },
    deviceSecret: plaintextSecret,
  });
}
