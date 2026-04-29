import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { assertStaffEventAccess } from "@/lib/staff/event-access";
import { subHours, startOfDay } from "date-fns";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  const range = url.searchParams.get("range") ?? "today";

  if (!eventId) {
    return jsonErr("eventId required");
  }

  const access = await assertStaffEventAccess({
    eventId,
    staffUserId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
  });

  if (!access.ok) {
    return jsonErr(access.message, access.status);
  }

  const now = new Date();
  let since: Date;
  switch (range) {
    case "last-hour":
      since = subHours(now, 1);
      break;
    case "four-hours":
      since = subHours(now, 4);
      break;
    case "today":
    default:
      since = startOfDay(now);
      break;
  }

  const audits = await prisma.auditEvent.findMany({
    where: {
      eventId,
      action: "GUEST_ADMISSION_CHANGED",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      staffUser: { select: { name: true, email: true } },
    },
  });

  const rows = audits.map((a) => {
    const m = a.metadata as Record<string, unknown>;
    const guestId = typeof m.guestId === "string" ? m.guestId : "";
    return {
      id: a.id,
      createdAt: a.createdAt.toISOString(),
      actorName: a.staffUser?.name ?? a.staffUser?.email ?? "System",
      action: m.to ? String(m.to) : "",
      reason: typeof m.reason === "string" ? m.reason : null,
      guestId,
    };
  });

  const guestIds = Array.from(new Set(rows.map((r) => r.guestId).filter(Boolean)));
  const guests = await prisma.guest.findMany({
    where: { id: { in: guestIds } },
    select: { id: true, name: true, externalId: true },
  });
  const guestMap = new Map(guests.map((g) => [g.id, g]));

  return jsonOk({
    entries: rows.map((r) => ({
      ...r,
      guestName:
        guestMap.get(r.guestId)?.name ??
        (r.guestId ? "Walk-up Guest" : "Unknown"),
      externalId: guestMap.get(r.guestId)?.externalId ?? null,
    })),
  });
}
