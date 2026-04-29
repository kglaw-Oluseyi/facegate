import { Decision, Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import {
  canExportSensitiveReports,
  canViewOperationalInsights,
} from "@/lib/roles";

function encodeCursor(attemptedAt: Date, id: string): string {
  return Buffer.from(`${attemptedAt.toISOString()}|${id}`, "utf8").toString(
    "base64url"
  );
}

function decodeCursor(raw: string | null): { attemptedAt: Date; id: string } | null {
  if (!raw) return null;
  try {
    const s = Buffer.from(raw, "base64url").toString("utf8");
    const idx = s.indexOf("|");
    if (idx === -1) return null;
    const attemptedAt = new Date(s.slice(0, idx));
    const id = s.slice(idx + 1);
    if (Number.isNaN(attemptedAt.getTime()) || !id) return null;
    return { attemptedAt, id };
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
  if (!canViewOperationalInsights(session)) return jsonErr("Forbidden", 403);

  const { eventId } = await context.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: session.user.tenantId },
    select: { id: true, startsAt: true, endsAt: true },
  });
  if (!event) return jsonErr("Event not found", 404);

  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const csvExport = format === "csv" && canExportSensitiveReports(session);
  if (format === "csv" && !canExportSensitiveReports(session)) {
    return jsonErr("CSV export requires administrator role", 403);
  }

  const decisionParam = url.searchParams.get("decision");
  const gateId = url.searchParams.get("gateId");
  const range = url.searchParams.get("range") ?? "full";
  const search = url.searchParams.get("search")?.trim();
  const hideDup = url.searchParams.get("hideDuplicates") !== "false";
  const cursorRaw = url.searchParams.get("cursor");
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 50, 1),
    csvExport ? 10_000 : 50
  );

  const now = new Date();
  let from: Date;
  let to: Date;

  if (range === "hour") {
    from = new Date(now.getTime() - 60 * 60 * 1000);
    to = now;
  } else if (range === "4h") {
    from = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    to = now;
  } else if (range === "today") {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
    to = now;
  } else {
    from = event.startsAt;
    to = event.endsAt;
  }

  const cursor = decodeCursor(cursorRaw);

  const andParts: Prisma.ReentryAttemptWhereInput[] = [];
  if (cursor) {
    andParts.push({
      OR: [
        { attemptedAt: { lt: cursor.attemptedAt } },
        {
          AND: [
            { attemptedAt: cursor.attemptedAt },
            { id: { lt: cursor.id } },
          ],
        },
      ],
    });
  }

  const where: Prisma.ReentryAttemptWhereInput = {
    eventId,
    attemptedAt: { gte: from, lte: to },
    ...(decisionParam &&
    decisionParam !== "ALL" &&
    (decisionParam === "ALLOW" ||
      decisionParam === "DENY" ||
      decisionParam === "ERROR")
      ? { decision: decisionParam as Decision }
      : {}),
    ...(gateId ? { gateId } : {}),
    ...(hideDup ? { duplicateOfAttemptId: null } : {}),
    ...(search
      ? {
          matchedGuest: {
            name: { contains: search, mode: "insensitive" },
          },
        }
      : {}),
    ...(andParts.length ? { AND: andParts } : {}),
  };

  const take = csvExport ? limit : limit + 1;

  const rows = await prisma.reentryAttempt.findMany({
    where,
    orderBy: [{ attemptedAt: "desc" }, { id: "desc" }],
    take,
    include: {
      gate: { select: { name: true, code: true } },
      matchedGuest: { select: { id: true, name: true } },
    },
  });

  if (csvExport) {
    const header =
      "attemptedAt,gate,decision,reason,guestName,latencyMs,duplicateOfAttemptId,id\n";
    const lines = rows.map((r) =>
      [
        r.attemptedAt.toISOString(),
        JSON.stringify(r.gate.name),
        r.decision,
        JSON.stringify(r.decisionReason),
        JSON.stringify(r.matchedGuest?.name ?? ""),
        r.latencyMs ?? "",
        r.duplicateOfAttemptId ?? "",
        r.id,
      ].join(",")
    );
    const csv = header + lines.join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="facegate-attempts-${eventId}.csv"`,
      },
    });
  }

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor(
          page[page.length - 1].attemptedAt,
          page[page.length - 1].id
        )
      : null;

  return jsonOk({
    attempts: page.map((a) => ({
      id: a.id,
      decision: a.decision,
      decisionReason: a.decisionReason,
      attemptedAt: a.attemptedAt.toISOString(),
      latencyMs: a.latencyMs,
      duplicateOfAttemptId: a.duplicateOfAttemptId,
      gate: a.gate,
      guest: a.matchedGuest,
    })),
    nextCursor,
    hasMore,
  });
}
