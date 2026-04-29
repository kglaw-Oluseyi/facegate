"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StaffRole } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload } from "lucide-react";

function parseCsvPreview(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.slice(0, 8).map((line) => line.split(",").map((c) => c.trim()));
}

export default function ImportGuestsPage() {
  const { data } = useSession();
  const router = useRouter();
  const role = data?.user?.role;

  const [eventId, setEventId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const allowed = role === StaffRole.ADMIN || role === StaffRole.PLATFORM_ADMIN;

  const loadEvent = useCallback(async () => {
    const res = await fetch("/api/staff/active-event");
    const json = await res.json();
    if (json?.data?.eventId) setEventId(json.data.eventId);
  }, []);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  if (!allowed) {
    return (
      <Card className="mx-auto max-w-lg border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-ink">Restricted</CardTitle>
          <CardDescription className="text-fg-mist">
            CSV import is limited to administrators.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function onFile(f: File | null) {
    setFile(f);
    setResult(null);
    if (!f) {
      setPreview([]);
      return;
    }
    const text = await f.text();
    setPreview(parseCsvPreview(text));
  }

  async function submit() {
    if (!file || !eventId) {
      toast.error("Select a CSV file");
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.append("eventId", eventId);
    fd.append("file", file);
    const res = await fetch("/api/staff/guests/import", {
      method: "POST",
      body: fd,
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok || json.error) {
      toast.error(json.error ?? "Import failed");
      return;
    }
    setResult(json.data);
    toast.success("Import finished");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg-ink">Import guests</h1>
        <p className="text-sm text-fg-mist">
          CSV columns: <span className="font-mono text-fg-ink">external_id</span>,{" "}
          <span className="font-mono text-fg-ink">name</span> (at least one per row).
        </p>
      </div>

      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-fg-ink">
            <Upload className="h-5 w-5 text-fg-gold" />
            Upload CSV
          </CardTitle>
          <CardDescription className="text-fg-mist">Drag and drop or browse.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-fg-line bg-fg-elevated px-6 py-12 text-center hover:border-fg-gold/40">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
            <span className="text-sm text-fg-mist">{file ? file.name : "Choose file"}</span>
          </label>

          {preview.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-fg-line hover:bg-transparent">
                  {preview[0]?.map((h, i) => (
                    <TableHead key={i} className="text-fg-mist">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.slice(1).map((row, ri) => (
                  <TableRow key={ri} className="border-fg-line">
                    {row.map((c, ci) => (
                      <TableCell key={ci} className="text-fg-ink">
                        {c}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          <Button
            type="button"
            className="bg-fg-gold text-fg-black"
            disabled={loading || !file || !eventId}
            onClick={() => void submit()}
          >
            {loading ? "Importing…" : "Import Guests"}
          </Button>

          {result ? (
            <div className="rounded-md border border-fg-line bg-fg-elevated p-4 text-sm text-fg-mist">
              <p>
                Created: <span className="text-fg-ink">{String(result.created)}</span>
              </p>
              <p>
                Updated: <span className="text-fg-ink">{String(result.updated)}</span>
              </p>
              <p>
                Skipped: <span className="text-fg-ink">{String(result.skipped)}</span>
              </p>
              {Array.isArray(result.errors) && result.errors.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-fg-danger-text">
                  {(result.errors as { row: number; message: string }[]).map((e) => (
                    <li key={e.row}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
