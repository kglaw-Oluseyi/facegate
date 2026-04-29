export const dynamic = "force-dynamic";
import { AdmissionState, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import {
  resolveIntegrationEventBySlug,
  verifyIntegrationApiKey,
} from "@/lib/integration-context";

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  if (!verifyIntegrationApiKey(_req)) {
    return jsonErr("Unauthorized", 401);
  }

  const { slug } = await context.params;

  const event = await resolveIntegrationEventBySlug(slug);
  if (!event) return jsonErr("Event not found", 404);

  const [gateCount, activeDeviceCount, checkedIn, enrolled] = await Promise.all([
    prisma.gate.count({ where: { eventId: event.id } }),
    prisma.gateDevice.count({
      where: {
        eventId: event.id,
        lastSeenAt: { gte: new Date(Date.now() - 180_000) },
      },
    }),
    prisma.guest.count({
      where: {
        eventId: event.id,
        admissionState: AdmissionState.CHECKED_IN,
      },
    }),
    prisma.biometricEnrollment.count({
      where: { eventId: event.id, status: EnrollmentStatus.ACTIVE },
    }),
  ]);

  return jsonOk({
    eventId: event.id,
    status: event.status,
    gateCount,
    activeDeviceCount,
    checkedIn,
    enrolled,
  });
}
