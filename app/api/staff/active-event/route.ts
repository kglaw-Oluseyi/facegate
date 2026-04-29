export const dynamic = "force-dynamic";
import { cookies } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { assertStaffEventAccess } from "@/lib/staff/event-access";
import { STAFF_EVENT_COOKIE, staffEventCookieOptions } from "@/lib/staff/cookies";
import { EventStatus } from "@prisma/client";

const bodySchema = z.object({
  eventId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("Invalid body");
  }

  const event = await prisma.event.findFirst({
    where: {
      id: parsed.data.eventId,
      tenantId: session.user.tenantId,
      status: { in: [EventStatus.READY, EventStatus.LIVE] },
    },
  });

  if (!event) {
    return jsonErr("Event not found or not selectable", 404);
  }

  const access = await assertStaffEventAccess({
    eventId: event.id,
    staffUserId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
  });

  if (!access.ok) {
    return jsonErr(access.message, access.status);
  }

  const cookieStore = await cookies();
  cookieStore.set(STAFF_EVENT_COOKIE, event.id, staffEventCookieOptions);

  return jsonOk({ eventId: event.id, name: event.name, mode: event.mode });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  const cookieStore = await cookies();
  const raw = cookieStore.get(STAFF_EVENT_COOKIE)?.value;
  if (!raw) {
    return jsonOk({
      eventId: null as string | null,
      name: null as string | null,
      mode: null as string | null,
    });
  }

  const event = await prisma.event.findFirst({
    where: { id: raw, tenantId: session.user.tenantId },
    select: { id: true, name: true, mode: true },
  });

  if (!event) {
    cookieStore.delete(STAFF_EVENT_COOKIE);
    return jsonOk({
      eventId: null as string | null,
      name: null as string | null,
      mode: null as string | null,
    });
  }

  return jsonOk({ eventId: event.id, name: event.name, mode: event.mode });
}
