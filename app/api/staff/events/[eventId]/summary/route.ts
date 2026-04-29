import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { assertStaffEventAccess } from "@/lib/staff/event-access";
import { AdmissionState, EnrollmentStatus } from "@prisma/client";

export async function GET(
  _req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  const { eventId } = await context.params;

  const access = await assertStaffEventAccess({
    eventId,
    staffUserId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
  });

  if (!access.ok) {
    return jsonErr(access.message, access.status);
  }


  const [totalGuests, checkedIn, enrolled] = await Promise.all([
    prisma.guest.count({ where: { eventId } }),
    prisma.guest.count({
      where: { eventId, admissionState: AdmissionState.CHECKED_IN },
    }),
    prisma.biometricEnrollment.count({
      where: { eventId, status: EnrollmentStatus.ACTIVE },
    }),
  ]);

  const notEnrolled = Math.max(0, checkedIn - enrolled);

  return jsonOk({
    totalGuests,
    checkedIn,
    enrolled,
    notEnrolled,
  });
}
