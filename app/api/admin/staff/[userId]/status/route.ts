export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { canManageStaff } from "@/lib/roles";
import { patchStaffStatusBody } from "@/lib/validators/admin";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);
  if (!canManageStaff(session)) return jsonErr("Forbidden", 403);

  const { userId } = await context.params;
  if (userId === session.user.id) {
    return jsonErr("You cannot change your own activation status");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON");
  }

  const parsed = patchStaffStatusBody.safeParse(body);
  if (!parsed.success) {
    return jsonErr("Invalid body");
  }

  const target = await prisma.staffUser.findFirst({
    where: { id: userId, tenantId: session.user.tenantId },
  });
  if (!target) return jsonErr("User not found", 404);

  const updated = await prisma.staffUser.update({
    where: { id: target.id },
    data: { isActive: parsed.data.isActive },
  });

  await writeAudit({
    tenantId: session.user.tenantId,
    staffUserId: session.user.id,
    action: parsed.data.isActive ? "STAFF_USER_ACTIVATED" : "STAFF_USER_DEACTIVATED",
    metadata: { targetUserId: target.id },
  });

  return jsonOk({ user: updated });
}
