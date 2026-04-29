export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";

export async function PATCH(
  _req: Request,
  context: { params: Promise<{ notificationId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  const { notificationId } = await context.params;

  const updated = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      recipientId: session.user.id,
    },
    data: { read: true },
  });

  if (updated.count === 0) return jsonErr("Not found", 404);

  return jsonOk({ ok: true });
}
