export const dynamic = "force-dynamic";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { assertStaffEventAccess } from "@/lib/staff/event-access";
import { createGuestBody, guestSearchQuery } from "@/lib/validators/staff";
import { EnrollmentStatus, Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return jsonErr("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const q = guestSearchQuery.safeParse({
    eventId: url.searchParams.get("eventId"),
    search: url.searchParams.get("search") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });

  if (!q.success) {
    return jsonErr("Invalid query");
  }

  const { eventId, search, cursor } = q.data;

  const access = await assertStaffEventAccess({
    eventId,
    staffUserId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
  });

  if (!access.ok) {
    return jsonErr(access.message, access.status);
  }

  const searchTrim = search?.trim() ?? "";

  const where: Prisma.GuestWhereInput = {
    eventId,
    ...(searchTrim.length > 0
      ? {
          OR: [
            { name: { contains: searchTrim, mode: "insensitive" } },
            { externalId: { contains: searchTrim, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(cursor
      ? {
          id: { gt: cursor },
        }
      : {}),
  };

  const guests = await prisma.guest.findMany({
    where,
    orderBy: { id: "asc" },
    take: 21,
    include: {
      enrollments: {
        where: { status: EnrollmentStatus.ACTIVE },
        take: 1,
      },
    },
  });

  const page = guests.slice(0, 20);
  const nextCursor = guests.length > 20 ? page[page.length - 1]?.id : null;

  return jsonOk({
    guests: page.map((g) => ({
      id: g.id,
      name: g.name,
      externalId: g.externalId,
      admissionState: g.admissionState,
      createdAt: g.createdAt.toISOString(),
      enrollmentStatus: g.enrollments[0]?.status ?? null,
      activeEnrollmentId: g.enrollments[0]?.id ?? null,
    })),
    nextCursor,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON");
  }

  const parsed = createGuestBody.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Validation failed";
    return jsonErr(msg);
  }

  const { eventId, name, externalId } = parsed.data;

  const access = await assertStaffEventAccess({
    eventId,
    staffUserId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
  });

  if (!access.ok) {
    return jsonErr(access.message, access.status);
  }

  const event = access.event;

  if (!name?.trim() && !externalId?.trim()) {
    const walkUpAllowed = event.mode === "STANDALONE";
    if (!walkUpAllowed) {
      return jsonErr("Provide a name or external ID for integrated events");
    }
  }

  if (externalId?.trim()) {
    const dup = await prisma.guest.findFirst({
      where: { eventId, externalId: externalId.trim() },
    });
    if (dup) {
      return jsonErr("A guest with this external ID already exists", 409);
    }
  }

  const guest = await prisma.guest.create({
    data: {
      eventId,
      name: name?.trim() || null,
      externalId: externalId?.trim() || null,
    },
  });

  await writeAudit({
    tenantId: session.user.tenantId,
    eventId,
    staffUserId: session.user.id,
    action: "GUEST_CREATED",
    metadata: {
      guestId: guest.id,
      clientRequestId: randomUUID(),
    },
  });

  return jsonOk({ guest });
}
