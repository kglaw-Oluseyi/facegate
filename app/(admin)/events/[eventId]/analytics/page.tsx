import type { Metadata } from "next";
import { EventAnalyticsDashboard } from "@/components/admin/event-analytics-dashboard";

export const metadata: Metadata = {
  title: "Event analytics · FaceGate OS",
};

export default async function EventAnalyticsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-fg-ink">Operational analytics</h1>
      <EventAnalyticsDashboard eventId={eventId} />
    </div>
  );
}
