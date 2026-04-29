import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAdminWrite, canExportSensitiveReports } from "@/lib/roles";
import { EventAuditExplorer } from "@/components/admin/event-audit-explorer";

export default async function EventAuditPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAdminWrite(session)) redirect("/dashboard");

  const { eventId } = await params;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-fg-ink">Audit log</h1>
      <EventAuditExplorer
        eventId={eventId}
        canExport={canExportSensitiveReports(session)}
      />
    </div>
  );
}
