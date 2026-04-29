export const dynamic = "force-dynamic";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { assertStaffEventAccess } from "@/lib/staff/event-access";
import { patchAdmissionBody } from "@/lib/validators/staff";
import { AdmissionState, StaffRole } from "@prisma/client";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ guestId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  const { guestId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON");
  }

  const parsed = patchAdmissionBody.safeParse(body);
  if (!parsed.success) {
    return jsonErr(parsed.error.flatten().formErrors.join(", ") || "Invalid body");
  }

  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: { event: true },
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

  const role = session.user.role;
  const { action, reason } = parsed.data;

  if (action === "CHECKIN") {
    const canCheckIn =
      role === StaffRole.STAFF ||
      role === StaffRole.SUPERVISOR ||
      role === StaffRole.ADMIN ||
      role === StaffRole.PLATFORM_ADMIN;
    if (!canCheckIn) return jsonErr("Forbidden", 403);
    if (guest.admissionState !== AdmissionState.NOT_CHECKED_IN) {
      return jsonErr("Guest is not awaiting check-in");
    }
  }

  if (action === "REVOKE" || action === "RESTORE") {
    if (
      !(
        role === StaffRole.SUPERVISOR ||
        role === StaffRole.ADMIN ||
        role === StaffRole.PLATFORM_ADMIN
      )
    ) {
      return jsonErr("Forbidden", 403);
    }
    if (!reason?.trim()) {
      return jsonErr("Reason is required");
    }
    if (action === "REVOKE" && guest.admissionState !== AdmissionState.CHECKED_IN) {
      return jsonErr("Guest must be checked in to revoke");
    }
    if (action === "RESTORE" && guest.admissionState !== AdmissionState.REVOKED) {
      return jsonErr("Guest must be revoked to restore");
    }
  }

  const from = guest.admissionState;
  let to: AdmissionState = from;

  if (action === "CHECKIN") to = AdmissionState.CHECKED_IN;
  if (action === "REVOKE") to = AdmissionState.REVOKED;
  if (action === "RESTORE") to = AdmissionState.CHECKED_IN;

  const updated = await prisma.$transaction(async (tx) => {
    const g = await tx.guest.update({
      where: { id: guest.id },
      data: { admissionState: to },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: session.user.tenantId,
        eventId: guest.eventId,
        staffUserId: session.user.id,
        actorType: "STAFF",
        actorId: session.user.id,
        action: "GUEST_ADMISSION_CHANGED",
        metadata: {
          guestId: guest.id,
          from,
          to,
          reason: reason ?? null,
          clientRequestId: randomUUID(),
        },
      },
    });

    return g;
  });

  return jsonOk({ guest: updated });
}
