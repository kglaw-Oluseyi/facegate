"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Entry = {
  id: string;
  createdAt: string;
  actorName: string;
  action: string;
  reason: string | null;
  guestName: string;
  externalId: string | null;
};

export default function CheckInLogPage() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [range, setRange] = useState("today");
  const [entries, setEntries] = useState<Entry[]>([]);

  const loadEvent = useCallback(async () => {
    const res = await fetch("/api/staff/active-event");
    const json = await res.json();
    if (json?.data?.eventId) setEventId(json.data.eventId);
  }, []);

  const poll = useCallback(async () => {
    if (!eventId) return;
    const res = await fetch(
      `/api/staff/check-in-log?eventId=${encodeURIComponent(eventId)}&range=${encodeURIComponent(range)}`
    );
    const json = await res.json();
    if (json?.data?.entries) setEntries(json.data.entries as Entry[]);
  }, [eventId, range]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    void poll();
    const t = setInterval(() => void poll(), 30_000);
    return () => clearInterval(t);
  }, [poll]);

  if (!eventId) {
    return (
      <p className="text-sm text-fg-mist">Select an event to view the check-in log.</p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg-ink">Check-in log</h1>
          <p className="text-sm text-fg-mist">Admission changes for this event (auto-refreshes every 30s).</p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-44 border-fg-line bg-fg-elevated">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-fg-line bg-fg-elevated text-fg-ink">
            <SelectItem value="last-hour">Last hour</SelectItem>
            <SelectItem value="four-hours">Last 4 hours</SelectItem>
            <SelectItem value="today">Today</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-ink">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {entries.length === 0 ? (
            <p className="text-sm text-fg-mist">No admission changes in this window.</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((e) => (
                <li key={e.id} className="rounded-lg border border-fg-line bg-fg-elevated px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-fg-ink">{e.guestName}</span>
                    <span className="text-xs text-fg-mist">
                      {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-1 text-fg-mist">
                    {e.actorName} · state {e.action}
                    {e.reason ? ` · ${e.reason}` : ""}
                  </p>
                  {e.externalId ? (
                    <p className="mt-1 font-mono text-xs text-fg-mist">{e.externalId}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
