import {
  AdmissionState,
  Decision,
  EnrollmentStatus,
  EventMode,
  EventStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { authenticateKioskDevice } from "@/lib/kiosk-auth";
import { resolveKioskConfig, type KioskConfigResolved } from "@/lib/kiosk-config";
import { kioskAttemptBody } from "@/lib/validators/kiosk";
import { getBiometricProvider } from "@/lib/biometric";
import { BiometricProviderError } from "@/lib/biometric/errors";

function buildAllowPayload(kioskConfig: KioskConfigResolved) {
  return {
    decision: "ALLOW" as const,
    reasonCode: "WALKIN_ENROLLED",
    displayName: undefined as string | undefined,
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

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return jsonErr("Event not found", 404);
  }

  const kioskConfig = resolveKioskConfig(event.kioskConfig);

  if (existing) {
    const ev = await prisma.event.findUnique({ where: { id: existing.eventId } });
    const kc = resolveKioskConfig(ev?.kioskConfig);
    let displayName: string | undefined;
    if (
      existing.decision === Decision.ALLOW &&
      kc.allowNameDisplay &&
      existing.matchedGuest?.name?.trim()
    ) {
      displayName = existing.matchedGuest!.name!.trim();
    }
    return jsonOk({
      decision:
        existing.decision === Decision.ALLOW
          ? ("ALLOW" as const)
          : existing.decision === Decision.ERROR
            ? ("ERROR" as const)
            : ("DENY" as const),
      reasonCode: existing.decisionReason,
      displayName,
      resetAfterMs: kc.resetAfterMs,
    });
  }

  if (event.mode !== EventMode.STANDALONE) {
    return jsonErr("Walk-in enrolment is only available for standalone events", 403);
  }

  if (!device.gate.isActive || event.status !== EventStatus.LIVE) {
    const latencyMs = Date.now() - started;
    await prisma.$transaction(async (tx) => {
      await tx.reentryAttempt.create({
        data: {
          eventId,
          gateId: device.gate.id,
          deviceId: device.id,
          clientRequestId,
          decision: Decision.DENY,
          decisionReason: "GATE_NOT_ACTIVE",
          latencyMs,
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
            decision: Decision.DENY,
            decisionReason: "GATE_NOT_ACTIVE",
            gateId: device.gate.id,
            deviceId: device.id,
            latencyMs,
          },
        },
      });
    });
    return jsonOk({
      decision: "DENY",
      reasonCode: "GATE_NOT_ACTIVE",
      resetAfterMs: kioskConfig.resetAfterMs,
    });
  }

  const guest = await prisma.guest.create({
    data: {
      eventId,
      admissionState: AdmissionState.CHECKED_IN,
    },
  });

  let enrollResult: { ref: string; provider: string };
  try {
    enrollResult = await getBiometricProvider().enroll({
      eventId,
      guestId: guest.id,
      imageBase64,
    });
  } catch (e) {
    await prisma.guest.delete({ where: { id: guest.id } }).catch(() => undefined);
    if (e instanceof BiometricProviderError) {
      const latencyMs = Date.now() - started;
      await prisma.$transaction(async (tx) => {
        await tx.reentryAttempt.create({
          data: {
            eventId,
            gateId: device.gate.id,
            deviceId: device.id,
            clientRequestId,
            decision: Decision.ERROR,
            decisionReason: "PROVIDER_ERROR",
            latencyMs,
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
              decision: Decision.ERROR,
              decisionReason: "PROVIDER_ERROR",
              gateId: device.gate.id,
              deviceId: device.id,
              latencyMs,
            },
          },
        });
      });
      return jsonOk({
        decision: "ERROR",
        reasonCode: "PROVIDER_ERROR",
        resetAfterMs: kioskConfig.resetAfterMs,
      });
    }
    throw e;
  }

  const latencyMs = Date.now() - started;

  let duplicateOfAttemptId: string | null = null;
  const prior = await prisma.reentryAttempt.findFirst({
    where: {
      deviceId: device.id,
      matchedGuestId: guest.id,
      decision: Decision.ALLOW,
      attemptedAt: { gte: new Date(Date.now() - 5000) },
    },
    orderBy: { attemptedAt: "desc" },
  });
  duplicateOfAttemptId = prior?.id ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.biometricEnrollment.create({
      data: {
        eventId,
        guestId: guest.id,
        provider: enrollResult.provider,
        providerBiometricRef: enrollResult.ref,
        status: EnrollmentStatus.ACTIVE,
        enrolledBy: null,
      },
    });

    await tx.reentryAttempt.create({
      data: {
        eventId,
        gateId: device.gate.id,
        deviceId: device.id,
        clientRequestId,
        decision: Decision.ALLOW,
        decisionReason: "WALKIN_ENROLLED",
        matchedGuestId: guest.id,
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
          decision: Decision.ALLOW,
          decisionReason: "WALKIN_ENROLLED",
          gateId: device.gate.id,
          deviceId: device.id,
          latencyMs,
          duplicateOfAttemptId,
          guestId: guest.id,
        },
      },
    });
  });

  return jsonOk(buildAllowPayload(kioskConfig));
}
