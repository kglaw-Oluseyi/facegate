export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { authenticateKioskDevice } from "@/lib/kiosk-auth";
import { resolveKioskConfig } from "@/lib/kiosk-config";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const deviceToken = url.searchParams.get("deviceToken")?.trim();

  const auth = await authenticateKioskDevice(req.headers.get("authorization"));
  if (!auth.ok) {
    return auth.response;
  }

  if (deviceToken && deviceToken !== auth.device.devicePublicId) {
    return jsonErr("deviceToken does not match credentials", 401);
  }

  const { device } = auth;
  const event = device.gate.event;
  const kioskConfig = resolveKioskConfig(event.kioskConfig);

  await prisma.gateDevice.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date() },
  });

  return jsonOk({
    deviceId: device.id,
    gateId: device.gate.id,
    eventId: event.id,
    gateName: device.gate.name,
    eventName: event.name,
    eventStatus: event.status,
    gateActive: device.gate.isActive,
    kioskConfig,
  });
}
