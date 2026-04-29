export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";

export async function PATCH() {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  await prisma.notification.updateMany({
    where: { recipientId: session.user.id, read: false },
    data: { read: true },
  });

  return jsonOk({ ok: true });
}
