export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";

export async function GET(
  _req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  const { eventId } = await context.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: session.user.tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      mode: true,
      venueName: true,
      venueTimezone: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (!event) return jsonErr("Event not found", 404);

  return jsonOk({ event });
}
