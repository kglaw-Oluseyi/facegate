export const dynamic = "force-dynamic";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { assertStaffEventAccess } from "@/lib/staff/event-access";
import { StaffRole } from "@prisma/client";

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  });
  return { headers, rows };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);

  if (session.user.role !== StaffRole.ADMIN && session.user.role !== StaffRole.PLATFORM_ADMIN) {
    return jsonErr("Forbidden", 403);
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return jsonErr("Expected multipart form upload");
  }

  const formData = await req.formData();
  const eventIdField = formData.get("eventId");
  const file = formData.get("file");

  if (typeof eventIdField !== "string" || !eventIdField) {
    return jsonErr("eventId is required");
  }

  if (!(file instanceof Blob)) {
    return jsonErr("file is required");
  }

  const access = await assertStaffEventAccess({
    eventId: eventIdField,
    staffUserId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
  });

  if (!access.ok) {
    return jsonErr(access.message, access.status);
  }

  const text = await file.text();
  const { headers, rows } = parseCsv(text);

  const idxExternal =
    headers.findIndex((h) => h.toLowerCase().replace(/\s/g, "_") === "external_id") >= 0
      ? headers.findIndex((h) => h.toLowerCase().replace(/\s/g, "_") === "external_id")
      : headers.findIndex((h) => h.toLowerCase() === "external id");

  const idxName = headers.findIndex((h) => h.toLowerCase() === "name");

  if (idxExternal === -1 && idxName === -1) {
    return jsonErr("CSV must include external_id and/or name columns");
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const externalRaw =
      idxExternal >= 0 ? row[idxExternal]?.replace(/^"|"$/g, "").trim() ?? "" : "";
    const nameRaw = idxName >= 0 ? row[idxName]?.replace(/^"|"$/g, "").trim() ?? "" : "";

    const externalId = externalRaw.length > 0 ? externalRaw : null;
    const name = nameRaw.length > 0 ? nameRaw : null;

    if (!externalId && !name) {
      errors.push({ row: r + 2, message: "At least one of external_id or name is required" });
      continue;
    }

    try {
      if (externalId) {
        const existing = await prisma.guest.findFirst({
          where: { eventId: eventIdField, externalId },
        });
        if (existing) {
          await prisma.guest.update({
            where: { id: existing.id },
            data: {
              name: name ?? existing.name,
            },
          });
          updated++;
        } else {
          await prisma.guest.create({
            data: {
              eventId: eventIdField,
              externalId,
              name,
            },
          });
          created++;
        }
      } else {
        await prisma.guest.create({
          data: {
            eventId: eventIdField,
            externalId: null,
            name,
          },
        });
        created++;
      }
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
      if (code === "P2002") {
        skipped++;
      } else {
        errors.push({ row: r + 2, message: e instanceof Error ? e.message : "Unknown error" });
      }
    }
  }

  await prisma.auditEvent.create({
    data: {
      tenantId: session.user.tenantId,
      eventId: eventIdField,
      staffUserId: session.user.id,
      actorType: "STAFF",
      actorId: session.user.id,
      action: "GUESTS_IMPORTED",
      metadata: {
        created,
        updated,
        skipped,
        clientRequestId: randomUUID(),
      },
    },
  });

  return jsonOk({ created, updated, skipped, errors });
}
