"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Decision } from "@prisma/client";
import { DecisionBadge } from "@/components/admin/decision-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type Row = {
  id: string;
  decision: Decision;
  decisionReason: string;
  attemptedAt: string;
  gate: { name: string; code: string };
  guest: { id: string; name: string | null } | null;
};

export function EventAttemptsExplorer({
  eventId,
  canExport,
}: {
  eventId: string;
  canExport: boolean;
}) {
  const [decision, setDecision] = useState<string>("ALL");
  const [range, setRange] = useState<string>("full");
  const [draftSearch, setDraftSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(
    async (nextCursor: string | null, append: boolean) => {
      setLoading(true);
      const sp = new URLSearchParams();
      if (decision !== "ALL") sp.set("decision", decision);
      sp.set("range", range);
      if (appliedSearch.trim()) sp.set("search", appliedSearch.trim());
      if (nextCursor) sp.set("cursor", nextCursor);
      const res = await fetch(`/api/admin/events/${eventId}/attempts?${sp}`);
      const json = await res.json();
      setLoading(false);
      if (!res.ok || json.error) return;
      setRows((prev) =>
        append ? [...prev, ...(json.data.attempts as Row[])] : (json.data.attempts as Row[])
      );
      setCursor(json.data.nextCursor ?? null);
    },
    [decision, range, appliedSearch, eventId]
  );

  useEffect(() => {
    void fetchPage(null, false);
  }, [eventId, decision, range, appliedSearch, fetchPage]);

  function exportCsv() {
    const sp = new URLSearchParams({ format: "csv" });
    if (decision !== "ALL") sp.set("decision", decision);
    sp.set("range", range);
    if (appliedSearch.trim()) sp.set("search", appliedSearch.trim());
    window.open(`/api/admin/events/${eventId}/attempts?${sp}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-mist">
        <Link href={`/events/${eventId}`} className="text-fg-gold hover:underline">
          ← Command centre
        </Link>
      </p>

      <div className="flex flex-wrap gap-3">
        <Select value={decision} onValueChange={setDecision}>
          <SelectTrigger className="w-40 border-fg-line bg-fg-elevated">
            <SelectValue placeholder="Decision" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All decisions</SelectItem>
            <SelectItem value="ALLOW">ALLOW</SelectItem>
            <SelectItem value="DENY">DENY</SelectItem>
            <SelectItem value="ERROR">ERROR</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-40 border-fg-line bg-fg-elevated">
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Event window</SelectItem>
            <SelectItem value="hour">Last hour</SelectItem>
            <SelectItem value="4h">Last 4h</SelectItem>
            <SelectItem value="today">Today</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Guest name contains…"
          value={draftSearch}
          onChange={(e) => setDraftSearch(e.target.value)}
          className="max-w-xs border-fg-line bg-fg-elevated"
        />
        <Button
          type="button"
          variant="outline"
          className="border-fg-line"
          onClick={() => setAppliedSearch(draftSearch.trim())}
        >
          Apply filters
        </Button>
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
                <TableHead className="text-fg-mist">Gate</TableHead>
                <TableHead className="text-fg-mist">Guest</TableHead>
                <TableHead className="text-fg-mist">Decision</TableHead>
                <TableHead className="text-fg-mist">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="border-fg-line">
                  <TableCell className="text-fg-mist">
                    {formatDistanceToNow(new Date(r.attemptedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-fg-ink">{r.gate.name}</TableCell>
                  <TableCell className="text-fg-mist">{r.guest?.name ?? "—"}</TableCell>
                  <TableCell>
                    <DecisionBadge decision={r.decision} />
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-fg-mist">
                    {r.decisionReason}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 && !loading ? (
            <p className="p-8 text-center text-sm text-fg-mist">No attempts match filters.</p>
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
