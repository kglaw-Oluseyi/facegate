import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { canManageStaff, isPlatformAdmin } from "@/lib/roles";
import { createStaffBody } from "@/lib/validators/admin";
import { StaffRole } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);
  if (!canManageStaff(session)) return jsonErr("Forbidden", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON");
  }

  const parsed = createStaffBody.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg = Object.values(first).flat()[0] ?? "Validation failed";
    return jsonErr(msg);
  }

  if (parsed.data.role === StaffRole.PLATFORM_ADMIN && !isPlatformAdmin(session)) {
    return jsonErr("Only a platform administrator can assign that role");
  }

  const tenantId = session.user.tenantId;
  const email = parsed.data.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    const user = await prisma.staffUser.create({
      data: {
        tenantId,
        email,
        name: parsed.data.name,
        passwordHash,
        role: parsed.data.role,
        isActive: true,
      },
    });

    await writeAudit({
      tenantId,
      staffUserId: session.user.id,
      action: "STAFF_USER_CREATED",
      metadata: { createdUserId: user.id, email: user.email, role: user.role },
    });

    return jsonOk({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    if (code === "P2002") {
      return jsonErr("A user with this email already exists");
    }
    console.error(e);
    return jsonErr("Could not create staff user", 500);
  }
}
