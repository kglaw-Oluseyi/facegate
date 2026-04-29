import bcrypt from "bcryptjs";
import { DeviceStatus } from "@prisma/client";
import type { Gate, GateDevice, Event } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonErr } from "@/lib/api-response";
import { writeAudit } from "@/lib/audit";

export type GateDeviceWithRelations = GateDevice & {
  gate: Gate & { event: Event };
};

export function parseBasicAuth(header: string | null): { user: string; pass: string } | null {
  if (!header || !header.startsWith("Basic ")) return null;
  const raw = Buffer.from(header.slice(6), "base64").toString("utf8");
  const idx = raw.indexOf(":");
  if (idx === -1) return null;
  return { user: raw.slice(0, idx), pass: raw.slice(idx + 1) };
}

/**
 * Validates kiosk device Basic credentials. Writes DEVICE_AUTH_FAILURE when the device exists but is inactive or the secret is wrong.
 */
export async function authenticateKioskDevice(authHeader: string | null): Promise<
  | { ok: true; device: GateDeviceWithRelations }
  | { ok: false; response: Response }
> {
  const parsed = parseBasicAuth(authHeader);
  if (!parsed) {
    return { ok: false, response: jsonErr("Missing or invalid Authorization header", 401) };
  }

  const device = await prisma.gateDevice.findUnique({
    where: { devicePublicId: parsed.user },
    include: {
      gate: { include: { event: true } },
    },
  });

  if (!device) {
    return { ok: false, response: jsonErr("Invalid credentials", 401) };
  }

  const tenantId = device.gate.event.tenantId;

  if (device.status !== DeviceStatus.ACTIVE) {
    await writeAudit({
      tenantId,
      eventId: device.eventId,
      action: "DEVICE_AUTH_FAILURE",
      metadata: { devicePublicId: parsed.user, reason: "DEVICE_NOT_ACTIVE" },
      actorType: "DEVICE",
      actorId: null,
    });
    return { ok: false, response: jsonErr("Invalid credentials", 401) };
  }

  const valid = await bcrypt.compare(parsed.pass, device.deviceSecretHash);
  if (!valid) {
    await writeAudit({
      tenantId,
      eventId: device.eventId,
      action: "DEVICE_AUTH_FAILURE",
      metadata: { devicePublicId: parsed.user, reason: "INVALID_SECRET" },
      actorType: "DEVICE",
      actorId: null,
    });
    return { ok: false, response: jsonErr("Invalid credentials", 401) };
  }

  return { ok: true, device };
}
