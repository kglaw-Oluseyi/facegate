export const dynamic = "force-dynamic";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { assertStaffEventAccess } from "@/lib/staff/event-access";
import { enrollBody } from "@/lib/validators/staff";
import { getBiometricProvider } from "@/lib/biometric";
import { BiometricProviderError } from "@/lib/biometric/errors";
import { AdmissionState, EnrollmentStatus } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON");
  }

  const parsed = enrollBody.safeParse(body);
  if (!parsed.success) {
    return jsonErr(parsed.error.flatten().formErrors.join(", ") || "Invalid body");
  }

  const { guestId, eventId, imageBase64 } = parsed.data;

  const access = await assertStaffEventAccess({
    eventId,
    staffUserId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
  });

  if (!access.ok) {
    return jsonErr(access.message, access.status);
  }

  const guest = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    include: { event: true },
  });

  if (!guest) {
    return jsonErr("Guest not found", 404);
  }

  if (guest.admissionState !== AdmissionState.CHECKED_IN) {
    return jsonErr("Guest must be checked in before enrolment");
  }

  const provider = getBiometricProvider();

  let enrollResult: { ref: string; provider: string };
  try {
    enrollResult = await provider.enroll({
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

  const conflict = await prisma.biometricEnrollment.findFirst({
    where: {
      eventId,
      providerBiometricRef: enrollResult.ref,
      status: EnrollmentStatus.ACTIVE,
      guestId: { not: guestId },
    },
    include: {
      guest: { select: { id: true, name: true } },
    },
  });

  if (conflict) {
    await provider.deleteRefs({ eventId, refs: [enrollResult.ref] }).catch(() => undefined);
    return Response.json(
      {
        data: {
          conflictingEnrollmentId: conflict.id,
          conflictingGuestId: conflict.guestId,
          conflictingGuestName: conflict.guest.name ?? "Walk-up Guest",
        },
        error: "ENROLLMENT_CONFLICT",
      },
      { status: 409 }
    );
  }

  const enrollment = await prisma.$transaction(async (tx) => {
    await tx.biometricEnrollment.updateMany({
      where: {
        eventId,
        guestId,
        status: EnrollmentStatus.ACTIVE,
      },
      data: { status: EnrollmentStatus.SUPERSEDED },
    });

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
        action: "GUEST_BIOMETRIC_ENROLLED",
        metadata: {
          guestId,
          enrollmentId: row.id,
          provider: enrollResult.provider,
          clientRequestId: randomUUID(),
        },
      },
    });

    return row;
  });

  return jsonOk({ enrollmentId: enrollment.id, status: "ACTIVE" as const });
}
