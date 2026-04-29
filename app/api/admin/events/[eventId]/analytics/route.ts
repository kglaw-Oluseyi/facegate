import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { canViewOperationalInsights } from "@/lib/roles";
import { computeEventAnalytics } from "@/lib/event-analytics";

export async function GET(
  _req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);
  if (!canViewOperationalInsights(session)) return jsonErr("Forbidden", 403);

  const { eventId } = await context.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: session.user.tenantId },
    select: { id: true },
  });
  if (!event) return jsonErr("Event not found", 404);

  const analytics = await computeEventAnalytics(eventId);

  return jsonOk(analytics);
}
