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
  });
  if (!event) return jsonErr("Event not found", 404);

  const gates = await prisma.gate.findMany({
    where: { eventId },
    orderBy: { name: "asc" },
    include: {
      devices: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          devicePublicId: true,
          status: true,
          lastSeenAt: true,
        },
      },
    },
  });

  return jsonOk({ gates });
}
