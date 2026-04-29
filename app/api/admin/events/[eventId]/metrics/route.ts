import { AdmissionState, Decision, EnrollmentStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";

export async function GET(
  _req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  const { eventId } = await context.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: session.user.tenantId },
  });
  if (!event) return jsonErr("Event not found", 404);

  const [
    checkedInCount,
    enrolledCount,
    allowCount,
    denyCount,
    errorCount,
  ] = await Promise.all([
    prisma.guest.count({
      where: { eventId, admissionState: AdmissionState.CHECKED_IN },
    }),
    prisma.biometricEnrollment.count({
      where: { eventId, status: EnrollmentStatus.ACTIVE },
    }),
    prisma.reentryAttempt.count({
      where: { eventId, decision: Decision.ALLOW },
    }),
    prisma.reentryAttempt.count({
      where: { eventId, decision: Decision.DENY },
    }),
    prisma.reentryAttempt.count({
      where: { eventId, decision: Decision.ERROR },
    }),
  ]);

  return jsonOk({
    checkedInCount,
    enrolledCount,
    allowCount,
    denyCount,
    errorCount,
  });
}
