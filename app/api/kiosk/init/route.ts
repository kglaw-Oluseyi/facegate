import { DeviceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { resolveKioskConfig } from "@/lib/kiosk-config";

export async function GET(req: Request) {
  const deviceToken = new URL(req.url).searchParams.get("deviceToken")?.trim();
  if (!deviceToken) {
    return jsonErr("deviceToken is required", 400);
  }

  const device = await prisma.gateDevice.findUnique({
    where: { devicePublicId: deviceToken },
    include: {
      gate: { include: { event: true } },
    },
  });

  if (!device || device.status !== DeviceStatus.ACTIVE) {
    return jsonOk({
      ok: false as const,
      code: "UNAUTHORISED_DEVICE" as const,
    });
  }

  await prisma.gateDevice.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date() },
  });

  const event = device.gate.event;
  const kioskConfig = resolveKioskConfig(event.kioskConfig);

  return jsonOk({
    ok: true as const,
    deviceId: device.id,
    gateId: device.gate.id,
    eventId: event.id,
    gateName: device.gate.name,
    eventName: event.name,
    eventStatus: event.status,
    gateActive: device.gate.isActive,
    mode: event.mode,
    kioskConfig,
  });
}
