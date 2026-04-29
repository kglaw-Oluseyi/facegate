import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { assertStaffEventAccess } from "@/lib/staff/event-access";
import { enrollTransferBody } from "@/lib/validators/staff";
import { getBiometricProvider } from "@/lib/biometric";
import { BiometricProviderError } from "@/lib/biometric/errors";
import { AdmissionState, EnrollmentStatus, StaffRole } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  const role = session.user.role;
  const canResolve =
    role === StaffRole.SUPERVISOR ||
    role === StaffRole.ADMIN ||
    role === StaffRole.PLATFORM_ADMIN;

  if (!canResolve) {
    return jsonErr("Forbidden", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON");
  }

  const parsed = enrollTransferBody.safeParse(body);
  if (!parsed.success) {
    return jsonErr(parsed.error.flatten().formErrors.join(", ") || "Invalid body");
  }

  const { guestId, eventId, conflictingEnrollmentId, imageBase64 } = parsed.data;

  const access = await assertStaffEventAccess({
    eventId,
    staffUserId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
  });

  if (!access.ok) {
    return jsonErr(access.message, access.status);
  }

  const currentGuest = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
  });

  if (!currentGuest || currentGuest.admissionState !== AdmissionState.CHECKED_IN) {
    return jsonErr("Guest not eligible", 400);
  }

  const conflictRow = await prisma.biometricEnrollment.findFirst({
    where: {
      id: conflictingEnrollmentId,
      eventId,
      status: EnrollmentStatus.ACTIVE,
    },
  });

  if (!conflictRow || conflictRow.guestId === guestId) {
    return jsonErr("Conflict enrollment not found", 404);
  }

  const bio = getBiometricProvider();

  await prisma.$transaction(async (tx) => {
    await tx.biometricEnrollment.update({
      where: { id: conflictRow.id },
      data: { status: EnrollmentStatus.REVOKED },
    });

    await tx.biometricEnrollment.updateMany({
      where: {
        eventId,
        guestId,
        status: EnrollmentStatus.ACTIVE,
      },
      data: { status: EnrollmentStatus.SUPERSEDED },
    });
  });

  if (conflictRow.providerBiometricRef) {
    try {
      await bio.deleteRefs({
        eventId,
        refs: [conflictRow.providerBiometricRef],
      });
    } catch {
      /* non-fatal */
    }
  }

  let enrollResult: { ref: string; provider: string };
  try {
    enrollResult = await bio.enroll({
      eventId,
      guestId,
      imageBase64,
    });
  } catch (e) {
    if (e instanceof BiometricProviderError) {
      return jsonErr(e.message, 502);
    }
    throw e;
  }

  const dup = await prisma.biometricEnrollment.findFirst({
    where: {
      eventId,
      providerBiometricRef: enrollResult.ref,
      status: EnrollmentStatus.ACTIVE,
      guestId: { not: guestId },
    },
  });

  if (dup) {
    await bio.deleteRefs({ eventId, refs: [enrollResult.ref] }).catch(() => undefined);
    return jsonErr("Enrollment collision — retry capture", 409);
  }

  const enrollment = await prisma.$transaction(async (tx) => {
    const row = await tx.biometricEnrollment.create({
      data: {
        eventId,
        guestId,
        provider: enrollResult.provider,
        providerBiometricRef: enrollResult.ref,
        status: EnrollmentStatus.ACTIVE,
        enrolledBy: session.user.id,
      },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: session.user.tenantId,
        eventId,
        staffUserId: session.user.id,
        actorType: "STAFF",
        actorId: session.user.id,
        action: "GUEST_BIOMETRIC_TRANSFERRED",
        metadata: {
          fromGuestId: conflictRow.guestId,
          toGuestId: guestId,
          revokedEnrollmentId: conflictRow.id,
          newEnrollmentId: row.id,
          clientRequestId: randomUUID(),
        },
      },
    });

    return row;
  });

  return jsonOk({ enrollmentId: enrollment.id, status: "ACTIVE" as const });
}
