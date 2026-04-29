import {
  AdmissionState,
  Decision,
  EnrollmentStatus,
  EventMode,
  EventStatus,
  type Guest,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { authenticateKioskDevice } from "@/lib/kiosk-auth";
import { resolveKioskConfig, type KioskConfigResolved } from "@/lib/kiosk-config";
import { kioskAttemptBody } from "@/lib/validators/kiosk";
import { getBiometricProvider } from "@/lib/biometric";
import { BiometricProviderError } from "@/lib/biometric/errors";

type AttemptPayload = {
  decision: "ALLOW" | "DENY" | "ERROR";
  reasonCode: string;
  displayName?: string;
  resetAfterMs: number;
};

function apiDecision(d: Decision): "ALLOW" | "DENY" | "ERROR" {
  if (d === Decision.ALLOW) return "ALLOW";
  if (d === Decision.ERROR) return "ERROR";
  return "DENY";
}

function buildPayload(
  decision: Decision,
  reasonCode: string,
  kioskConfig: KioskConfigResolved,
  guest?: { name: string | null } | null
): AttemptPayload {
  let displayName: string | undefined;
  if (
    decision === Decision.ALLOW &&
    kioskConfig.allowNameDisplay &&
    guest?.name &&
    guest.name.trim()
  ) {
    displayName = guest.name.trim();
  }
  return {
    decision: apiDecision(decision),
    reasonCode,
    displayName,
    resetAfterMs: kioskConfig.resetAfterMs,
  };
}

export async function POST(req: Request) {
  const started = Date.now();

  const auth = await authenticateKioskDevice(req.headers.get("authorization"));
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON");
  }

  const parsed = kioskAttemptBody.safeParse(body);
  if (!parsed.success) {
    return jsonErr(parsed.error.flatten().formErrors.join(", ") || "Invalid body");
  }

  const { clientRequestId, imageBase64 } = parsed.data;
  const device = auth.device;
  const tenantId = device.gate.event.tenantId;
  const eventId = device.eventId;

  const existing = await prisma.reentryAttempt.findUnique({
    where: { clientRequestId },
    include: { matchedGuest: true },
  });

  if (existing) {
    const ev = await prisma.event.findUnique({ where: { id: existing.eventId } });
    const kioskConfig = resolveKioskConfig(ev?.kioskConfig);
    return jsonOk(
      buildPayload(existing.decision, existing.decisionReason, kioskConfig, existing.matchedGuest)
    );
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return jsonErr("Event not found", 404);
  }

  const kioskConfig = resolveKioskConfig(event.kioskConfig);

  let decision: Decision = Decision.DENY;
  let reasonCode = "UNKNOWN";
  let matchedGuestId: string | null = null;
  let guestForDisplay: Guest | null = null;

  if (!device.gate.isActive || event.status !== EventStatus.LIVE) {
    decision = Decision.DENY;
    reasonCode = "GATE_NOT_ACTIVE";
  } else {
    const enrollmentRows = await prisma.biometricEnrollment.findMany({
      where: {
        eventId,
        status: EnrollmentStatus.ACTIVE,
        providerBiometricRef: { not: null },
      },
      select: { providerBiometricRef: true },
      orderBy: { providerBiometricRef: "asc" },
    });

    const enrolledRefs = enrollmentRows
      .map((r) => r.providerBiometricRef)
      .filter((r): r is string => !!r);

    try {
      const matchResult = await getBiometricProvider().match({
        eventId,
        imageBase64,
        enrolledRefs,
      });

      if (!matchResult.matched || !matchResult.matchedRef) {
        decision = Decision.DENY;
        reasonCode = "NO_BIOMETRIC_MATCH";
      } else {
        const enrollment = await prisma.biometricEnrollment.findFirst({
          where: {
            eventId,
            status: EnrollmentStatus.ACTIVE,
            providerBiometricRef: matchResult.matchedRef,
          },
          include: { guest: true },
        });

        if (!enrollment) {
          decision = Decision.DENY;
          reasonCode = "MATCH_NOT_LINKED_TO_GUEST";
        } else {
          const guest = enrollment.guest;

          if (event.mode === EventMode.INTEGRATED) {
            if (guest.admissionState === AdmissionState.NOT_CHECKED_IN) {
              decision = Decision.DENY;
              reasonCode = "GUEST_NOT_CHECKED_IN";
            } else if (guest.admissionState === AdmissionState.REVOKED) {
              decision = Decision.DENY;
              reasonCode = "GUEST_REVOKED";
            } else if (guest.admissionState === AdmissionState.CHECKED_IN) {
              decision = Decision.ALLOW;
              reasonCode = "MATCHED_CHECKED_IN_GUEST";
              matchedGuestId = guest.id;
              guestForDisplay = guest;
            } else {
              decision = Decision.DENY;
              reasonCode = "GUEST_NOT_CHECKED_IN";
            }
          } else {
            decision = Decision.ALLOW;
            reasonCode = "MATCHED_CHECKED_IN_GUEST";
            matchedGuestId = guest.id;
            guestForDisplay = guest;
          }
        }
      }
    } catch (e) {
      if (e instanceof BiometricProviderError) {
        decision = Decision.ERROR;
        reasonCode = "PROVIDER_ERROR";
      } else {
        throw e;
      }
    }
  }

  const latencyMs = Date.now() - started;

  let duplicateOfAttemptId: string | null = null;
  if (decision === Decision.ALLOW && matchedGuestId) {
    const prior = await prisma.reentryAttempt.findFirst({
      where: {
        deviceId: device.id,
        matchedGuestId,
        decision: Decision.ALLOW,
        attemptedAt: { gte: new Date(Date.now() - 5000) },
      },
      orderBy: { attemptedAt: "desc" },
    });
    duplicateOfAttemptId = prior?.id ?? null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.reentryAttempt.create({
      data: {
        eventId,
        gateId: device.gate.id,
        deviceId: device.id,
        clientRequestId,
        decision,
        decisionReason: reasonCode,
        matchedGuestId,
        latencyMs,
        duplicateOfAttemptId,
      },
    });

    await tx.auditEvent.create({
      data: {
        tenantId,
        eventId,
        action: "REENTRY_ATTEMPT",
        actorType: "DEVICE",
        actorId: null,
        metadata: {
          clientRequestId,
          decision,
          decisionReason: reasonCode,
          gateId: device.gate.id,
          deviceId: device.id,
          latencyMs,
          duplicateOfAttemptId,
        },
      },
    });
  });

  return jsonOk(buildPayload(decision, reasonCode, kioskConfig, guestForDisplay));
}
