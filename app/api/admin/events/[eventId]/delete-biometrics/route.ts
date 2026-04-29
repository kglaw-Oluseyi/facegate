export const dynamic = "force-dynamic";
import { EventStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { canAdminWrite } from "@/lib/roles";
import { runBiometricDeletion } from "@/lib/jobs/deletion";

export async function POST(
  _req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);
  if (!canAdminWrite(session)) return jsonErr("Forbidden", 403);

  const { eventId } = await context.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: session.user.tenantId },
  });
  if (!event) return jsonErr("Event not found", 404);

  if (event.status !== EventStatus.CLOSED && event.status !== EventStatus.ARCHIVED) {
    return jsonErr("Event must be CLOSED or ARCHIVED before biometric deletion");
  }

  const running = await prisma.deletionRun.findFirst({
    where: { eventId: event.id, status: "RUNNING" },
  });
  if (running) {
    return jsonErr("A biometric deletion run is already in progress", 409);
  }

  const result = await runBiometricDeletion(event.id, session.user.id);

  if (!result.success) {
    return jsonErr(result.errors.join("; ") || "Deletion failed", 502);
  }

  const runRow = await prisma.deletionRun.findUnique({
    where: { id: result.deletionRunId },
    select: { completedAt: true },
  });

  return jsonOk({
    success: true,
    enrollmentCount: result.enrollmentCount,
    deletionRunId: result.deletionRunId,
    completedAt: runRow?.completedAt?.toISOString() ?? new Date().toISOString(),
  });
}
