import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EventStatus, EnrollmentStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAdminWrite } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EventDeletionActions } from "@/components/admin/event-deletion-actions";

export default async function EventDeletionPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAdminWrite(session)) redirect("/dashboard");

  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: session.user.tenantId },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });
  if (!event) notFound();

  const activeEnrollments = await prisma.biometricEnrollment.count({
    where: { eventId: event.id, status: EnrollmentStatus.ACTIVE },
  });

  const runs = await prisma.deletionRun.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const running = runs.find((r) => r.status === "RUNNING");
  const lastCompleted = runs.find((r) => r.status === "COMPLETED");

  const canDelete =
    event.status === EventStatus.CLOSED || event.status === EventStatus.ARCHIVED;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-fg-mist">
            <Link href={`/events/${event.id}`} className="text-fg-gold hover:underline">
              ← Command centre
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-fg-ink">
            Biometric deletion · {event.name}
          </h1>
        </div>
        <Badge variant="outline" className="border-fg-line">
          {event.status}
        </Badge>
      </div>

      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-ink">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-fg-mist">
          <p>
            Active enrollments recorded in FaceGate:{" "}
            <span className="font-medium text-fg-ink">{activeEnrollments}</span>
          </p>
          {running ? (
            <p className="text-fg-warning-text">
              A deletion run is currently in progress ({running.id}).
            </p>
          ) : null}
          {!canDelete ? (
            <p>
              Deletion is only available after the event is{" "}
              <span className="text-fg-ink">CLOSED</span> or{" "}
              <span className="text-fg-ink">ARCHIVED</span>.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-ink">Certificate</CardTitle>
          <p className="text-sm text-fg-mist">
            After a successful run, download the PDF certificate for your records.
          </p>
        </CardHeader>
        <CardContent>
          {lastCompleted ? (
            <Button asChild variant="outline" className="border-fg-line">
              <a
                href={`/api/admin/events/${event.id}/deletion-certificate?runId=${lastCompleted.id}`}
              >
                Download certificate ({lastCompleted.enrollmentCount} enrollments)
              </a>
            </Button>
          ) : (
            <p className="text-sm text-fg-mist">No completed deletion run yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-fg-danger/40 bg-fg-danger/10">
        <CardHeader>
          <CardTitle className="text-fg-danger-text">Run deletion</CardTitle>
          <p className="text-sm text-fg-mist">
            This triggers provider deletion hooks, soft-deletes enrollments, and notifies tenant
            administrators. You cannot start another run while one is active.
          </p>
        </CardHeader>
        <CardContent>
          <EventDeletionActions
            eventId={event.id}
            disabled={!canDelete || !!running}
          />
        </CardContent>
      </Card>

      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-ink">Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-fg-mist">No deletion runs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {runs.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap justify-between gap-2 border-b border-fg-line py-2 last:border-0"
                >
                  <span className="font-mono text-xs text-fg-ink">{r.id}</span>
                  <span className="text-fg-mist">{r.status}</span>
                  <span className="text-fg-mist">
                    {r.completedAt?.toISOString() ?? r.createdAt.toISOString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
