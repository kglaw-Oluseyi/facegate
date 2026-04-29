import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  canExportSensitiveReports,
  canViewOperationalInsights,
} from "@/lib/roles";
import { EventAttemptsExplorer } from "@/components/admin/event-attempts-explorer";

export default async function EventAttemptsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canViewOperationalInsights(session)) redirect("/dashboard");

  const { eventId } = await params;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-fg-ink">Re-entry attempts</h1>
      <EventAttemptsExplorer
        eventId={eventId}
        canExport={canExportSensitiveReports(session)}
      />
    </div>
  );
}
