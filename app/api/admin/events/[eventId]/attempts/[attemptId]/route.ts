export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { canViewOperationalInsights } from "@/lib/roles";

export async function GET(
  _req: Request,
  context: { params: Promise<{ eventId: string; attemptId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);
  if (!canViewOperationalInsights(session)) return jsonErr("Forbidden", 403);

  const { eventId, attemptId } = await context.params;

  const attempt = await prisma.reentryAttempt.findFirst({
    where: {
      id: attemptId,
      eventId,
      event: { tenantId: session.user.tenantId },
    },
    include: {
      gate: { select: { id: true, name: true, code: true } },
      device: { select: { id: true, devicePublicId: true } },
      matchedGuest: {
        select: { id: true, name: true, admissionState: true },
      },
    },
  });

  if (!attempt) return jsonErr("Attempt not found", 404);

  return jsonOk({
    attempt: {
      id: attempt.id,
      decision: attempt.decision,
      decisionReason: attempt.decisionReason,
      latencyMs: attempt.latencyMs,
      attemptedAtServer: attempt.attemptedAt.toISOString(),
      duplicateOfAttemptId: attempt.duplicateOfAttemptId,
      gate: attempt.gate,
      device: attempt.device,
      guest: attempt.matchedGuest,
    },
  });
}
