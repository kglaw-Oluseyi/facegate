export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr } from "@/lib/api-response";
import { canAdminWrite } from "@/lib/roles";
import { buildDeletionCertificatePdf } from "@/lib/pdf/deletion-certificate";

export async function GET(
  req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);
  if (!canAdminWrite(session)) return jsonErr("Forbidden", 403);

  const { eventId } = await context.params;
  const runId = new URL(req.url).searchParams.get("runId");
  if (!runId) return jsonErr("runId required", 400);

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: session.user.tenantId },
    select: { name: true },
  });
  if (!event) return jsonErr("Event not found", 404);

  const run = await prisma.deletionRun.findFirst({
    where: { id: runId, eventId },
  });
  if (!run || run.status !== "COMPLETED") {
    return jsonErr("Certificate unavailable", 404);
  }

  const pdfBuffer = buildDeletionCertificatePdf({
    eventName: event.name,
    enrollmentCount: run.enrollmentCount,
    completedAtIso: run.completedAt?.toISOString() ?? new Date().toISOString(),
    deletionRunId: run.id,
    confirmedByName: session.user.name ?? session.user.email ?? "Administrator",
    providerConfirmed: run.providerConfirmed,
  });

  return new Response(Buffer.from(new Uint8Array(pdfBuffer)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="facegate-deletion-${run.id}.pdf"`,
    },
  });
}
