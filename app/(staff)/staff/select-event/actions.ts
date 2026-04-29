"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertStaffEventAccess } from "@/lib/staff/event-access";
import { STAFF_EVENT_COOKIE, staffEventCookieOptions } from "@/lib/staff/cookies";
import { EventStatus } from "@prisma/client";

export async function selectStaffEvent(formData: FormData) {
  const eventId = formData.get("eventId");
  if (typeof eventId !== "string" || !eventId) {
    throw new Error("Missing event");
  }

  const session = await auth();
  if (!session?.user) redirect("/login");

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      tenantId: session.user.tenantId,
      status: { in: [EventStatus.READY, EventStatus.LIVE] },
    },
  });

  if (!event) {
    throw new Error("Event not available");
  }

  const access = await assertStaffEventAccess({
    eventId,
    staffUserId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
  });

  if (!access.ok) {
    throw new Error("Forbidden");
  }

  const cookieStore = await cookies();
  cookieStore.set(STAFF_EVENT_COOKIE, eventId, staffEventCookieOptions);
  redirect("/staff/guests");
}
