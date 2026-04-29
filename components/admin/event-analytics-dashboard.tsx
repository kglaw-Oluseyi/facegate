"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsPayload } from "@/lib/event-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PIE_COLORS = ["#22c55e", "#ef4444", "#94a3b8", "#c9a84c"];

export function EventAnalyticsDashboard({
  eventId,
}: {
  eventId: string;
}) {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/events/${eventId}/analytics`);
      const json = await res.json();
      if (cancelled) return;
      if (!res.ok || json.error) {
        setErr(json.error ?? "Could not load analytics");
        return;
      }
      setData(json.data as AnalyticsPayload);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (err) {
    return <p className="text-sm text-fg-danger-text">{err}</p>;
  }
  if (!data) {
    return <p className="text-sm text-fg-mist">Loading charts…</p>;
  }

  const decisionPie = data.decisionSplit.map((d) => ({
    name: d.decision,
    value: d.count,
  }));

  const hourly = data.hourlyAllows.map((h) => ({
    label: new Date(h.hour).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
    allows: h.count,
  }));

  const gates = data.gateAllows.map((g) => ({
    name: g.gateName.slice(0, 18),
    allows: g.count,
  }));

  const throughput = data.throughput.map((t) => ({
    label: new Date(t.bucket).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
    attempts: t.count,
  }));

  const empty =
    !data.hourlyAllows.length &&
    !data.decisionSplit.length &&
    !data.gateAllows.length &&
    !data.throughput.length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-fg-mist">
        <Link href={`/events/${eventId}`} className="text-fg-gold hover:underline">
          ← Command centre
        </Link>
      </p>

      {empty ? (
        <Card className="border-fg-line border-dashed bg-fg-surface">
          <CardContent className="py-12 text-center text-fg-mist">
            No attempt data in range yet.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="ALLOW attempts by hour">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="label" tick={{ fill: "#888", fontSize: 11 }} />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#141414", border: "1px solid #333" }}
              />
              <Line type="monotone" dataKey="allows" stroke="#c9a84c" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Decision split">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={decisionPie}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                label
              >
                {decisionPie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip
                contentStyle={{ background: "#141414", border: "1px solid #333" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="ALLOW by gate">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={gates}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 10 }} />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#141414", border: "1px solid #333" }}
              />
              <Bar dataKey="allows" fill="#c9a84c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Throughput (5 min buckets)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={throughput}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="label" tick={{ fill: "#888", fontSize: 11 }} />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#141414", border: "1px solid #333" }}
              />
              <Line
                type="monotone"
                dataKey="attempts"
                stroke="#94a3b8"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-fg-line bg-fg-surface">
      <CardHeader>
        <CardTitle className="text-base text-fg-ink">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
