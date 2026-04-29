import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { writeAudit } from "@/lib/audit";
import { canAdminWrite } from "@/lib/roles";
import { patchEventKioskConfigBody } from "@/lib/validators/admin";
import { resolveKioskConfig } from "@/lib/kiosk-config";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);
  if (!canAdminWrite(session)) return jsonErr("Forbidden", 403);

  const { eventId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON");
  }

  const parsed = patchEventKioskConfigBody.safeParse(body);
  if (!parsed.success) {
    return jsonErr(parsed.error.flatten().formErrors.join(", ") || "Validation failed");
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: session.user.tenantId },
  });

  if (!event) return jsonErr("Event not found", 404);

  const prevResolved = resolveKioskConfig(event.kioskConfig);
  const { consentPerEventConfirmed, ...patchFields } = parsed.data;

  if (
    patchFields.consentMode === "per-event" &&
    prevResolved.consentMode !== "per-event"
  ) {
    if (!consentPerEventConfirmed) {
      return jsonErr(
        "Confirmation is required to switch consent mode to Per Event"
      );
    }

    await writeAudit({
      tenantId: session.user.tenantId,
      eventId: event.id,
      staffUserId: session.user.id,
      actorType: "STAFF",
      actorId: session.user.id,
      action: "KIOSK_PER_EVENT_CONSENT_CONFIRMED",
      metadata: {
        eventName: event.name,
        confirmationPhraseExpected: "I CONFIRM",
      },
    });
  }

  const existingRaw =
    typeof event.kioskConfig === "object" &&
    event.kioskConfig !== null &&
    !Array.isArray(event.kioskConfig)
      ? (event.kioskConfig as Record<string, unknown>)
      : {};

  const nextConfig = {
    ...existingRaw,
    consentMode: patchFields.consentMode,
    allowNameDisplay: patchFields.allowNameDisplay,
    allowCopy: patchFields.allowCopy,
    denyCopy: patchFields.denyCopy,
    errorCopy: patchFields.errorCopy,
    unavailableCopy: patchFields.unavailableCopy,
    resetAfterMs: patchFields.resetAfterMs,
    theme:
      patchFields.theme ??
      (typeof existingRaw.theme === "string" ? existingRaw.theme : undefined),
    primaryColour:
      patchFields.primaryColour ??
      (typeof existingRaw.primaryColour === "string"
        ? existingRaw.primaryColour
        : undefined),
    backgroundColour:
      patchFields.backgroundColour ??
      (typeof existingRaw.backgroundColour === "string"
        ? existingRaw.backgroundColour
        : undefined),
    textColour:
      patchFields.textColour ??
      (typeof existingRaw.textColour === "string"
        ? existingRaw.textColour
        : undefined),
  };

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { kioskConfig: nextConfig },
  });

  await writeAudit({
    tenantId: session.user.tenantId,
    eventId: event.id,
    staffUserId: session.user.id,
    actorType: "STAFF",
    actorId: session.user.id,
    action: "KIOSK_CONFIG_UPDATED",
    metadata: {
      consentMode: patchFields.consentMode,
      allowNameDisplay: patchFields.allowNameDisplay,
      resetAfterMs: patchFields.resetAfterMs,
    },
  });

  return jsonOk({
    event: updated,
    kioskConfig: resolveKioskConfig(updated.kioskConfig),
  });
}
