export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";

export async function GET() {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  const items = await prisma.notification.findMany({
    where: { recipientId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      read: true,
      createdAt: true,
      eventId: true,
    },
  });

  const unread = await prisma.notification.count({
    where: { recipientId: session.user.id, read: false },
  });

  return jsonOk({
    notifications: items.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount: unread,
  });
}
