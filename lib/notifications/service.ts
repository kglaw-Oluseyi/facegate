import { prisma } from "@/lib/prisma";

export async function notifyTenantStaff(params: {
  tenantId: string;
  eventId?: string | null;
  type: string;
  title: string;
  body: string;
  recipientRoles?: Array<"ADMIN" | "PLATFORM_ADMIN" | "SUPERVISOR">;
}) {
  const roles = params.recipientRoles ?? ["ADMIN", "PLATFORM_ADMIN"];
  const users = await prisma.staffUser.findMany({
    where: {
      tenantId: params.tenantId,
      isActive: true,
      role: { in: roles },
    },
    select: { id: true },
  });

  if (users.length === 0) return;

  await prisma.notification.createMany({
    data: users.map((u) => ({
      tenantId: params.tenantId,
      eventId: params.eventId ?? null,
      recipientId: u.id,
      type: params.type,
      title: params.title,
      body: params.body,
    })),
  });
}
