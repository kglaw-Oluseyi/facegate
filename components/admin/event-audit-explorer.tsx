"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditCategory } from "@/lib/audit-labels";

type Row = {
  id: string;
  action: string;
  actionLabel: string;
  actorType: string;
  createdAt: string;
};

export function EventAuditExplorer({
  eventId,
  canExport,
}: {
  eventId: string;
  canExport: boolean;
}) {
  const [category, setCategory] = useState<AuditCategory | "ALL">("ALL");
  const [range, setRange] = useState<string>("full");
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(
    async (nextCursor: string | null, append: boolean) => {
      setLoading(true);
      const sp = new URLSearchParams();
      if (category !== "ALL") sp.set("category", category);
      sp.set("range", range);
      if (nextCursor) sp.set("cursor", nextCursor);
      const res = await fetch(`/api/admin/events/${eventId}/audit?${sp}`);
      const json = await res.json();
      setLoading(false);
      if (!res.ok || json.error) return;
      setRows((prev) =>
        append ? [...prev, ...(json.data.rows as Row[])] : (json.data.rows as Row[])
      );
      setCursor(json.data.nextCursor ?? null);
    },
    [category, range, eventId]
  );

  useEffect(() => {
    void fetchPage(null, false);
  }, [eventId, category, range, fetchPage]);

  function exportCsv() {
    const sp = new URLSearchParams({ format: "csv" });
    if (category !== "ALL") sp.set("category", category);
    sp.set("range", range);
    window.open(`/api/admin/events/${eventId}/audit?${sp}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-mist">
        <Link href={`/events/${eventId}`} className="text-fg-gold hover:underline">
          ← Command centre
        </Link>
      </p>

      <div className="flex flex-wrap gap-3">
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as AuditCategory | "ALL")}
        >
          <SelectTrigger className="w-48 border-fg-line bg-fg-elevated">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            <SelectItem value="ADMISSION">Admission</SelectItem>
            <SelectItem value="ENROLMENT">Enrolment</SelectItem>
            <SelectItem value="DEVICE">Device</SelectItem>
            <SelectItem value="CONFIGURATION">Configuration</SelectItem>
            <SelectItem value="DELETION">Deletion</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-40 border-fg-line bg-fg-elevated">
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">All time</SelectItem>
            <SelectItem value="hour">Last hour</SelectItem>
            <SelectItem value="today">Today</SelectItem>
          </SelectContent>
        </Select>
        {canExport ? (
          <Button type="button" variant="outline" className="border-fg-line" onClick={exportCsv}>
            Export CSV
          </Button>
        ) : null}
      </div>

      <Card className="border-fg-line bg-fg-surface">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-fg-line hover:bg-transparent">
                <TableHead className="text-fg-mist">When</TableHead>
                <TableHead className="text-fg-mist">Action</TableHead>
                <TableHead className="text-fg-mist">Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="border-fg-line">
                  <TableCell className="text-fg-mist">
                    {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-sm text-fg-ink">{r.actionLabel}</TableCell>
                  <TableCell className="text-fg-mist">{r.actorType}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 && !loading ? (
            <p className="p-8 text-center text-sm text-fg-mist">No audit events yet.</p>
          ) : null}
          {cursor ? (
            <div className="border-t border-fg-line p-4">
              <Button
                type="button"
                variant="outline"
                className="border-fg-line"
                disabled={loading}
                onClick={() => void fetchPage(cursor, true)}
              >
                {loading ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
