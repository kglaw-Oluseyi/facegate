import { EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { getBiometricProvider } from "@/lib/biometric";
import { BiometricProviderError } from "@/lib/biometric/errors";

export type DeletionResult = {
  success: boolean;
  enrollmentCount: number;
  deletionRunId: string;
  errors: string[];
};

export async function runBiometricDeletion(
  eventId: string,
  triggeredBy: string
): Promise<DeletionResult> {
  const errors: string[] = [];
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return {
      success: false,
      enrollmentCount: 0,
      deletionRunId: "",
      errors: ["Event not found"],
    };
  }

  const enrollments = await prisma.biometricEnrollment.findMany({
    where: {
      eventId,
      status: { not: EnrollmentStatus.DELETED },
      providerBiometricRef: { not: null },
    },
    select: {
      id: true,
      providerBiometricRef: true,
      provider: true,
    },
  });

  const enrollmentCount = enrollments.length;

  const run = await prisma.deletionRun.create({
    data: {
      eventId,
      triggeredBy,
      status: "RUNNING",
      enrollmentCount,
      providerConfirmed: false,
    },
  });

  await writeAudit({
    tenantId: event.tenantId,
    eventId,
    staffUserId: triggeredBy.startsWith("SYSTEM") ? undefined : triggeredBy,
    actorType: triggeredBy.startsWith("SYSTEM") ? "SYSTEM" : "STAFF",
    actorId: triggeredBy.startsWith("SYSTEM") ? null : triggeredBy,
    action: "DELETION_RUN_STARTED",
    metadata: {
      deletionRunId: run.id,
      enrollmentCount,
      triggeredBy,
    },
  });

  const provider = getBiometricProvider();

  const refGroups = new Map<string, string[]>();
  for (const row of enrollments) {
    const ref = row.providerBiometricRef;
    if (!ref) continue;
    const key = row.provider;
    const arr = refGroups.get(key) ?? [];
    arr.push(ref);
    refGroups.set(key, arr);
  }

  try {
    for (const [, refs] of refGroups) {
      try {
        await provider.deleteRefs({ eventId, refs });
      } catch (e) {
        const msg =
          e instanceof BiometricProviderError ? e.message : String(e);
        errors.push(`deleteRefs: ${msg}`);
      }
    }

    try {
      await provider.deleteCollection(eventId);
    } catch (e) {
      const msg =
        e instanceof BiometricProviderError ? e.message : String(e);
      errors.push(`deleteCollection: ${msg}`);
    }

    if (errors.length > 0) {
      await prisma.deletionRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          providerConfirmed: false,
          auditRef: errors.join("; ").slice(0, 500),
        },
      });
      await writeAudit({
        tenantId: event.tenantId,
        eventId,
        actorType: "SYSTEM",
        actorId: null,
        action: "DELETION_RUN_FAILED",
        metadata: {
          deletionRunId: run.id,
          errors,
          enrollmentCount,
        },
      });

      const { notifyTenantStaff } = await import("@/lib/notifications/service");
      await notifyTenantStaff({
        tenantId: event.tenantId,
        eventId,
        type: "DELETION_FAILED",
        title: "Biometric deletion failed",
        body: errors.slice(0, 3).join("; ") || "Provider deletion reported errors.",
      }).catch(() => undefined);

      return {
        success: false,
        enrollmentCount,
        deletionRunId: run.id,
        errors,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.biometricEnrollment.updateMany({
        where: {
          eventId,
          status: { not: EnrollmentStatus.DELETED },
        },
        data: {
          status: EnrollmentStatus.DELETED,
          providerBiometricRef: null,
        },
      });

      await tx.deletionRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          enrollmentCount,
          providerConfirmed: true,
          completedAt: new Date(),
          auditRef: run.id,
        },
      });
    });

    await writeAudit({
      tenantId: event.tenantId,
      eventId,
      staffUserId: triggeredBy.startsWith("SYSTEM") ? undefined : triggeredBy,
      actorType: triggeredBy.startsWith("SYSTEM") ? "SYSTEM" : "STAFF",
      actorId: triggeredBy.startsWith("SYSTEM") ? null : triggeredBy,
      action: "DELETION_RUN_COMPLETED",
      metadata: {
        deletionRunId: run.id,
        enrollmentCount,
      },
    });

    const { notifyTenantStaff } = await import("@/lib/notifications/service");
    await notifyTenantStaff({
      tenantId: event.tenantId,
      eventId,
      type: "DELETION_COMPLETED",
      title: "Biometric deletion completed",
      body: `${enrollmentCount} enrolment references removed for this event.`,
    }).catch(() => undefined);

    return {
      success: true,
      enrollmentCount,
      deletionRunId: run.id,
      errors: [],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.deletionRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        auditRef: msg.slice(0, 500),
      },
    }).catch(() => undefined);

    await writeAudit({
      tenantId: event.tenantId,
      eventId,
      actorType: "SYSTEM",
      actorId: null,
      action: "DELETION_RUN_FAILED",
      metadata: {
        deletionRunId: run.id,
        error: msg,
      },
    });

    return {
      success: false,
      enrollmentCount,
      deletionRunId: run.id,
      errors: [...errors, msg],
    };
  }
}
