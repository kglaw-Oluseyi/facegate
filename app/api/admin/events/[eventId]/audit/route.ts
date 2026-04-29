import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import {
  AUDIT_GROUPS,
  auditActionLabel,
  auditCategory,
  type AuditCategory,
} from "@/lib/audit-labels";
import { canAdminWrite, canExportSensitiveReports } from "@/lib/roles";

function encodeAuditCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString(
    "base64url"
  );
}

function decodeAuditCursor(raw: string | null): { createdAt: Date; id: string } | null {
  if (!raw) return null;
  try {
    const s = Buffer.from(raw, "base64url").toString("utf8");
    const idx = s.indexOf("|");
    if (idx === -1) return null;
    const createdAt = new Date(s.slice(0, idx));
    const id = s.slice(idx + 1);
    if (Number.isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);
  if (!canAdminWrite(session)) return jsonErr("Forbidden", 403);

  const { eventId } = await context.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: session.user.tenantId },
    select: { id: true },
  });
  if (!event) return jsonErr("Event not found", 404);

  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const csvExport = format === "csv" && canExportSensitiveReports(session);
  if (format === "csv" && !canExportSensitiveReports(session)) {
    return jsonErr("CSV export requires administrator role", 403);
  }

  const actorFilter = url.searchParams.get("actor") ?? "ALL";
  const categoryFilter =
    (url.searchParams.get("category") as AuditCategory | "ALL") ?? "ALL";
  const range = url.searchParams.get("range") ?? "full";
  const cursorRaw = url.searchParams.get("cursor");
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 50, 1),
    csvExport ? 50_000 : 50
  );

  const now = new Date();
  let from: Date;
  let to: Date;
  if (range === "hour") {
    from = new Date(now.getTime() - 60 * 60 * 1000);
    to = now;
  } else if (range === "today") {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
    to = now;
  } else {
    from = new Date(0);
    to = now;
  }

  const cursor = decodeAuditCursor(cursorRaw);

  const andParts: Prisma.AuditEventWhereInput[] = [];
  if (cursor) {
    andParts.push({
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        {
          AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }],
        },
      ],
    });
  }

  if (actorFilter === "STAFF") {
    andParts.push({ actorType: "STAFF" });
  } else if (actorFilter === "SYSTEM") {
    andParts.push({ actorType: "SYSTEM" });
  } else if (actorFilter === "DEVICE") {
    andParts.push({ actorType: "DEVICE" });
  }

  if (categoryFilter !== "ALL") {
    andParts.push({
      action: { in: [...AUDIT_GROUPS[categoryFilter]] },
    });
  }

  const where: Prisma.AuditEventWhereInput = {
    eventId,
    tenantId: session.user.tenantId,
    createdAt: { gte: from, lte: to },
    ...(andParts.length ? { AND: andParts } : {}),
  };

  const take = csvExport ? limit : limit + 1;

  const rows = await prisma.auditEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: {
      staffUser: { select: { name: true, email: true, role: true } },
    },
  });

  if (csvExport) {
    const header =
      "createdAt,actorType,actorLabel,action,actionLabel,metadata\n";
    const lines = rows.map((r) => {
      const actorLabel =
        r.staffUser?.name ??
        (r.actorType === "DEVICE"
          ? "Gate Device"
          : r.actorType === "SYSTEM"
            ? "System"
            : "—");
      return [
        r.createdAt.toISOString(),
        r.actorType,
        JSON.stringify(actorLabel),
        r.action,
        JSON.stringify(auditActionLabel(r.action)),
        JSON.stringify(JSON.stringify(r.metadata)),
      ].join(",");
    });
    return new Response(header + lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="facegate-audit-${eventId}.csv"`,
      },
    });
  }

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && page.length > 0
      ? encodeAuditCursor(
          page[page.length - 1].createdAt,
          page[page.length - 1].id
        )
      : null;

  return jsonOk({
    rows: page.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      actorType: r.actorType,
      actorLabel:
        r.staffUser?.name ??
        (r.actorType === "DEVICE"
          ? "Gate Device"
          : r.actorType === "SYSTEM"
            ? "System"
            : "—"),
      actorRole: r.staffUser?.role ?? null,
      action: r.action,
      actionLabel: auditActionLabel(r.action),
      category: auditCategory(r.action),
      metadata: r.metadata,
    })),
    nextCursor,
    hasMore,
  });
}
