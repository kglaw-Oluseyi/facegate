"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AdmissionState, EnrollmentStatus, EventMode, StaffRole } from "@prisma/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { DecisionBadge } from "@/components/admin/decision-badge";
import { EnrollmentModal } from "@/components/staff/enrollment-modal";
import { Users } from "lucide-react";

type GuestRow = {
  id: string;
  name: string | null;
  externalId: string | null;
  admissionState: AdmissionState;
  createdAt: string;
  enrollmentStatus: EnrollmentStatus | null;
  activeEnrollmentId: string | null;
};

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function GuestWorkspace() {
  const { data: session, update } = useSession();
  const role = session?.user?.role;

  const [eventId, setEventId] = useState<string | null>(null);
  const [eventMode, setEventMode] = useState<EventMode | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);

  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [panelGuestId, setPanelGuestId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [reasonOpen, setReasonOpen] = useState<"REVOKE" | "RESTORE" | null>(null);
  const [reason, setReason] = useState("");
  const [enrollOpen, setEnrollOpen] = useState(false);

  const loadEvent = useCallback(async () => {
    const res = await fetch("/api/staff/active-event");
    const json = await res.json();
    if (json?.data?.eventId) {
      setEventId(json.data.eventId);
      setEventMode(json.data.mode ?? null);
    } else {
      setEventId(null);
      setEventMode(null);
    }
  }, []);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  const fetchFirstPage = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    const params = new URLSearchParams({ eventId });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    const res = await fetch(`/api/staff/guests?${params.toString()}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok || json.error) {
      toast.error(json.error ?? "Could not load guests");
      return;
    }
    setGuests(json.data.guests as GuestRow[]);
    setNextCursor(json.data.nextCursor as string | null);
  }, [eventId, debouncedSearch]);

  useEffect(() => {
    void fetchFirstPage();
  }, [fetchFirstPage]);

  const loadMore = useCallback(async () => {
    if (!eventId || !nextCursor) return;
    const params = new URLSearchParams({ eventId, cursor: nextCursor });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    const res = await fetch(`/api/staff/guests?${params.toString()}`);
    const json = await res.json();
    if (!res.ok || json.error) {
      toast.error(json.error ?? "Could not load guests");
      return;
    }
    const page = json.data.guests as GuestRow[];
    setGuests((prev) => [...prev, ...page]);
    setNextCursor(json.data.nextCursor as string | null);
  }, [eventId, debouncedSearch, nextCursor]);

  const refreshGuest = useCallback(async (id: string) => {
    const res = await fetch(`/api/staff/guests/${id}`);
    const json = await res.json();
    if (res.ok && json.data?.guest) {
      setDetail(json.data.guest as Record<string, unknown>);
    }
  }, []);

  useEffect(() => {
    if (!panelGuestId) {
      setDetail(null);
      return;
    }
    void refreshGuest(panelGuestId);
  }, [panelGuestId, refreshGuest]);

  async function patchAdmission(action: "CHECKIN" | "REVOKE" | "RESTORE", guestId: string) {
    if ((action === "REVOKE" || action === "RESTORE") && !reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    const res = await fetch(`/api/staff/guests/${guestId}/admission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        reason: action === "CHECKIN" ? undefined : reason.trim(),
      }),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      toast.error(json.error ?? "Update failed");
      return;
    }
    toast.success("Admission updated");
    setReason("");
    setReasonOpen(null);
    setGuests((prev) =>
      prev.map((g) =>
        g.id === guestId ? { ...g, admissionState: json.data.guest.admissionState } : g
      )
    );
    await refreshGuest(guestId);
    void update();
  }

  async function addWalkUp() {
    if (!eventId) return;
    const res = await fetch("/api/staff/guests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      toast.error(json.error ?? "Could not add guest");
      return;
    }
    toast.success("Walk-up guest added");
    await fetchFirstPage();
  }

  const canSupervise =
    role === StaffRole.SUPERVISOR || role === StaffRole.ADMIN || role === StaffRole.PLATFORM_ADMIN;

  const walkUpAllowed = eventMode === EventMode.STANDALONE;

  const activeEnrollment = detail?.activeEnrollment as Record<string, unknown> | null | undefined;

  if (!eventId) {
    return (
      <Card className="border-fg-line bg-fg-surface">
        <CardContent className="py-10 text-center text-sm text-fg-mist">
          Select an event to manage guests.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 space-y-3">
          <Input
            autoFocus
            placeholder="Search name or external ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 border-fg-line bg-fg-elevated text-lg text-fg-ink"
          />
          <p className="text-xs text-fg-mist">Results update as you type.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {walkUpAllowed ? (
            <Button type="button" className="bg-fg-gold text-fg-black" onClick={() => void addWalkUp()}>
              Add Walk-up Guest
            </Button>
          ) : null}
          {(role === StaffRole.ADMIN || role === StaffRole.PLATFORM_ADMIN) && (
            <Button type="button" variant="outline" className="border-fg-line" asChild>
              <Link href="/staff/guests/import">Import guests</Link>
            </Button>
          )}
        </div>
      </div>

      {loading && guests.length === 0 ? (
        <p className="text-sm text-fg-mist">Loading guests…</p>
      ) : guests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-fg-line py-16 text-center">
          <Users className="h-10 w-10 text-fg-mist opacity-40" />
          <p className="max-w-md text-sm text-fg-mist">
            No guests yet. Import a guest list or add walk-up guests.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {guests.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setPanelGuestId(g.id)}
              className="rounded-lg border border-fg-line bg-fg-surface p-4 text-left transition hover:border-fg-gold/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-fg-ink">{g.name ?? "Walk-up Guest"}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-fg-line text-fg-mist">
                    {String(g.admissionState).replaceAll("_", " ")}
                  </Badge>
                  <Badge variant="outline" className="border-fg-line text-fg-gold">
                    {g.enrollmentStatus === EnrollmentStatus.ACTIVE ? "Enrolled" : "Not enrolled"}
                  </Badge>
                </div>
              </div>
              {g.externalId ? (
                <p className="mt-1 font-mono text-xs text-fg-mist">{g.externalId}</p>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {nextCursor ? (
        <Button type="button" variant="outline" className="border-fg-line" onClick={() => void loadMore()}>
          Load more
        </Button>
      ) : null}

      <Sheet open={!!panelGuestId} onOpenChange={(o) => !o && setPanelGuestId(null)}>
        <SheetContent className="w-full overflow-y-auto border-fg-line bg-fg-surface sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-fg-ink">
              {(detail?.name as string | null) ?? "Walk-up Guest"}
            </SheetTitle>
            <SheetDescription className="font-mono text-xs text-fg-mist">
              {(detail?.externalId as string | null) ?? "—"}
            </SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="mt-6 space-y-4 text-sm">
              <p className="text-fg-mist">
                Created{" "}
                {formatDistanceToNow(new Date(detail.createdAt as string), { addSuffix: true })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{String(detail.admissionState)}</Badge>
                <Badge variant="outline">{activeEnrollment ? "Enrolled" : "Not enrolled"}</Badge>
              </div>

              <Separator className="bg-fg-line" />

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-fg-mist">Admission history</p>
                <ul className="space-y-2 text-fg-mist">
                  {((detail.admissionAudits as Array<Record<string, unknown>>) ?? []).map((a) => {
                    const m = a.metadata as Record<string, unknown>;
                    return (
                      <li key={String(a.id)} className="text-xs">
                        {formatDistanceToNow(new Date(a.createdAt as string), { addSuffix: true })} —{" "}
                        {String(m?.to ?? "")}
                        {typeof m?.reason === "string" && m.reason ? ` — ${m.reason}` : ""}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <Separator className="bg-fg-line" />

              <div className="flex flex-col gap-2">
                {detail.admissionState === AdmissionState.NOT_CHECKED_IN &&
                (role === StaffRole.STAFF ||
                  role === StaffRole.SUPERVISOR ||
                  role === StaffRole.ADMIN ||
                  role === StaffRole.PLATFORM_ADMIN) ? (
                  <Button
                    type="button"
                    className="bg-fg-gold text-fg-black"
                    onClick={() => void patchAdmission("CHECKIN", panelGuestId!)}
                  >
                    Check In
                  </Button>
                ) : null}

                {detail.admissionState === AdmissionState.CHECKED_IN && canSupervise ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-500/40 text-amber-100"
                    onClick={() => setReasonOpen("REVOKE")}
                  >
                    Revoke Admission
                  </Button>
                ) : null}

                {detail.admissionState === AdmissionState.REVOKED && canSupervise ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-500/40 text-amber-100"
                    onClick={() => setReasonOpen("RESTORE")}
                  >
                    Restore Admission
                  </Button>
                ) : null}

                {detail.admissionState === AdmissionState.CHECKED_IN && !activeEnrollment ? (
                  <Button
                    type="button"
                    className="bg-fg-gold text-fg-black"
                    onClick={() => setEnrollOpen(true)}
                  >
                    Enrol Face
                  </Button>
                ) : null}

                {activeEnrollment ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-fg-line"
                    onClick={() => setEnrollOpen(true)}
                  >
                    Re-enrol Face
                  </Button>
                ) : null}
              </div>

              {reasonOpen ? (
                <div className="space-y-2 rounded-md border border-fg-line p-3">
                  <Label className="text-fg-mist">Reason (required)</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="border-fg-line bg-fg-elevated"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-fg-line"
                      onClick={() => setReasonOpen(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="bg-amber-700 text-white hover:bg-amber-700/90"
                      onClick={() => void patchAdmission(reasonOpen, panelGuestId!)}
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              ) : null}

              <Separator className="bg-fg-line" />
              <p className="text-xs uppercase tracking-wide text-fg-mist">Recent attempts</p>
              <ul className="space-y-3">
                {((detail.attempts as Array<Record<string, unknown>>) ?? []).map((a) => (
                  <li key={String(a.id)} className="flex flex-col gap-1 rounded-md border border-fg-line p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-fg-mist">{(a.gate as { name: string }).name}</span>
                      <DecisionBadge decision={a.decision as never} />
                    </div>
                    <span className="text-xs text-fg-mist">
                      {formatDistanceToNow(new Date(a.attemptedAt as string), { addSuffix: true })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-6 text-sm text-fg-mist">Loading…</p>
          )}
        </SheetContent>
      </Sheet>

      {panelGuestId ? (
        <EnrollmentModal
          open={enrollOpen}
          onClose={() => setEnrollOpen(false)}
          eventId={eventId}
          guestId={panelGuestId}
          guestName={(detail?.name as string | null) ?? null}
          onCompleted={() => {
            void refreshGuest(panelGuestId);
            void fetchFirstPage();
          }}
        />
      ) : null}
    </div>
  );
}
