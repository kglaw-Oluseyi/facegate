import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { assertStaffEventAccess } from "@/lib/staff/event-access";
import { EnrollmentStatus } from "@prisma/client";

export async function GET(
  _req: Request,
  context: { params: Promise<{ guestId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  const { guestId } = await context.params;

  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: {
      event: true,
      enrollments: { orderBy: { enrolledAt: "desc" } },
      attempts: {
        orderBy: { attemptedAt: "desc" },
        take: 5,
        include: { gate: { select: { name: true, code: true } } },
      },
    },
  });

  if (!guest || guest.event.tenantId !== session.user.tenantId) {
    return jsonErr("Guest not found", 404);
  }

  const access = await assertStaffEventAccess({
    eventId: guest.eventId,
    staffUserId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
  });

  if (!access.ok) {
    return jsonErr(access.message, access.status);
  }

  const auditsRaw = await prisma.auditEvent.findMany({
    where: {
      eventId: guest.eventId,
      action: "GUEST_ADMISSION_CHANGED",
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const audits = auditsRaw
    .filter((a) => {
      const m = a.metadata as Record<string, unknown> | null;
      return m?.guestId === guest.id;
    })
    .slice(0, 20);

  return jsonOk({
    guest: {
      id: guest.id,
      eventId: guest.eventId,
      name: guest.name,
      externalId: guest.externalId,
      admissionState: guest.admissionState,
      createdAt: guest.createdAt.toISOString(),
      updatedAt: guest.updatedAt.toISOString(),
      enrollments: guest.enrollments.map((e) => ({
        id: e.id,
        status: e.status,
        provider: e.provider,
        providerBiometricRef: e.providerBiometricRef,
        enrolledAt: e.enrolledAt.toISOString(),
      })),
      activeEnrollment:
        guest.enrollments.find((e) => e.status === EnrollmentStatus.ACTIVE) ?? null,
      attempts: guest.attempts.map((a) => ({
        id: a.id,
        decision: a.decision,
        attemptedAt: a.attemptedAt.toISOString(),
        gate: a.gate,
      })),
      admissionAudits: audits.map((a) => ({
        id: a.id,
        action: a.action,
        createdAt: a.createdAt.toISOString(),
        metadata: a.metadata,
      })),
    },
  });
}
