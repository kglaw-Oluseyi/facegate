export const dynamic = "force-dynamic";
import { AdmissionState } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { writeAudit } from "@/lib/audit";
import {
  resolveIntegrationEventBySlug,
  verifyIntegrationApiKey,
} from "@/lib/integration-context";

const guestRow = z.object({
  externalId: z.string().min(1),
  name: z.string().optional(),
  admissionState: z
    .enum(["NOT_CHECKED_IN", "CHECKED_IN"])
    .optional(),
});

const bodySchema = z.object({
  guests: z.array(guestRow).max(5000),
});

function validAdmissionTransition(
  from: AdmissionState,
  to: AdmissionState
): boolean {
  if (from === to) return true;
  if (from === AdmissionState.REVOKED) return false;
  if (to === AdmissionState.NOT_CHECKED_IN && from === AdmissionState.CHECKED_IN) {
    return false;
  }
  return true;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  if (!verifyIntegrationApiKey(req)) {
    return jsonErr("Unauthorized", 401);
  }

  const { slug } = await context.params;

  const event = await resolveIntegrationEventBySlug(slug);
  if (!event) return jsonErr("Event not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(parsed.error.flatten().formErrors.join(", ") || "Invalid body");
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { externalId: string; reason: string }[] = [];

  for (const row of parsed.data.guests) {
    try {
      const existing = await prisma.guest.findUnique({
        where: {
          eventId_externalId: {
            eventId: event.id,
            externalId: row.externalId,
          },
        },
      });

      if (!existing) {
        await prisma.guest.create({
          data: {
            eventId: event.id,
            externalId: row.externalId,
            name: row.name,
            admissionState:
              row.admissionState === "CHECKED_IN"
                ? AdmissionState.CHECKED_IN
                : AdmissionState.NOT_CHECKED_IN,
          },
        });
        created += 1;
        continue;
      }

      let nextState = existing.admissionState;
      if (row.admissionState) {
        const desired =
          row.admissionState === "CHECKED_IN"
            ? AdmissionState.CHECKED_IN
            : AdmissionState.NOT_CHECKED_IN;
        if (!validAdmissionTransition(existing.admissionState, desired)) {
          skipped += 1;
          errors.push({
            externalId: row.externalId,
            reason: "Invalid admission transition",
          });
          continue;
        }
        nextState = desired;
      }

      const nextName =
        row.name !== undefined ? row.name : existing.name ?? undefined;

      const changed =
        nextState !== existing.admissionState ||
        (nextName !== undefined && nextName !== existing.name);

      if (!changed) {
        skipped += 1;
        continue;
      }

      await prisma.guest.update({
        where: { id: existing.id },
        data: {
          name: nextName ?? existing.name,
          admissionState: nextState,
        },
      });

      updated += 1;

      if (nextState !== existing.admissionState) {
        await writeAudit({
          tenantId: event.tenantId,
          eventId: event.id,
          actorType: "SYSTEM",
          actorId: null,
          action: "GUEST_ADMISSION_CHANGED",
          metadata: {
            guestId: existing.id,
            externalId: row.externalId,
            from: existing.admissionState,
            to: nextState,
            source: "integration_sync",
          },
        });
      }
    } catch (e) {
      errors.push({
        externalId: row.externalId,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await writeAudit({
    tenantId: event.tenantId,
    eventId: event.id,
    actorType: "SYSTEM",
    actorId: null,
    action: "GUEST_SYNC_MANIFEST",
    metadata: {
      processed: parsed.data.guests.length,
      created,
      updated,
      skipped,
      errorCount: errors.length,
    },
  });

  return jsonOk({
    processed: parsed.data.guests.length,
    created,
    updated,
    skipped,
    errors,
  });
}
