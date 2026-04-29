import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { canAdminWrite } from "@/lib/roles";
import { createEventBody } from "@/lib/validators/admin";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);
  if (!canAdminWrite(session)) return jsonErr("Forbidden", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON");
  }

  const parsed = createEventBody.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Validation failed";
    return jsonErr(msg);
  }

  const { name, slug, venueName, venueTimezone, startsAt, endsAt, mode } = parsed.data;
  const tenantId = session.user.tenantId;

  try {
    const event = await prisma.event.create({
      data: {
        tenantId,
        name,
        slug,
        venueName,
        venueTimezone,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        mode,
      },
    });

    await writeAudit({
      tenantId,
      eventId: event.id,
      staffUserId: session.user.id,
      action: "EVENT_CREATED",
      metadata: { eventId: event.id, slug: event.slug },
    });

    return jsonOk({ event });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    if (code === "P2002") {
      return jsonErr("An event with this slug already exists for your organisation");
    }
    console.error(e);
    return jsonErr("Could not create event", 500);
  }
}
