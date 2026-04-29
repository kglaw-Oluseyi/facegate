"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Decision,
  DeviceStatus,
  EventMode,
  EventStatus,
  GateType,
} from "@prisma/client";
import { toast } from "sonner";
import { canAdminWrite } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventStatusBadge } from "@/components/admin/status-badge";
import { EventModeBadge } from "@/components/admin/mode-badge";
import { DecisionBadge } from "@/components/admin/decision-badge";
import type { KioskConfigResolved } from "@/lib/kiosk-config";
import type { GateHealthDevice } from "@/lib/live-event-metrics";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type GateDeviceRow = {
  id: string;
  devicePublicId: string;
  status: DeviceStatus;
  lastSeenAt: string | null;
};

type GateRow = {
  id: string;
  name: string;
  code: string;
  gateType: GateType;
  isActive: boolean;
  devices: GateDeviceRow[];
};

type AttemptRow = {
  id: string;
  decision: Decision;
  decisionReason: string;
  attemptedAt: string;
  gateName: string;
  guestName?: string | null;
};

type LiveMetricBundle = {
  checkedIn: number;
  enrolled: number;
  allowCount: number;
  denyCount: number;
  errorCount: number;
  uniqueReentered: number;
  activeDevices: number;
};

const KIOSK_THEME_PRESETS = {
  obsidian: {
    theme: "obsidian",
    backgroundColour: "#0A0A0A",
    primaryColour: "#b79f85",
    textColour: "#F5F5F0",
  },
  ivory: {
    theme: "ivory",
    backgroundColour: "#F8F4EE",
    primaryColour: "#8B6F2E",
    textColour: "#1A1814",
  },
  slate: {
    theme: "slate",
    backgroundColour: "#0F1419",
    primaryColour: "#7B9EAE",
    textColour: "#E8EDF0",
  },
  custom: {
    theme: "custom",
    backgroundColour: "#0A0A0A",
    primaryColour: "#b79f85",
    textColour: "#F5F5F0",
  },
} as const;

function devicePulseClass(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "bg-fg-danger-text";
  const sec = (Date.now() - new Date(lastSeenAt).getTime()) / 1000;
  if (sec <= 90) return "bg-fg-success-text";
  if (sec <= 180) return "bg-fg-warning-text";
  return "bg-fg-danger-text";
}

function mergeGateDevices(
  prev: GateRow[],
  gateHealth: GateHealthDevice[]
): GateRow[] {
  const byGate = new Map<string, GateHealthDevice[]>();
  for (const gh of gateHealth) {
    const list = byGate.get(gh.gateId) ?? [];
    list.push(gh);
    byGate.set(gh.gateId, list);
  }
  return prev.map((g) => {
    const rows = byGate.get(g.id);
    if (!rows?.length) return g;
    return {
      ...g,
      devices: rows.map((h) => ({
        id: h.deviceId,
        devicePublicId: h.devicePublicId,
        status: DeviceStatus.ACTIVE,
        lastSeenAt: h.lastSeenAt,
      })),
    };
  });
}

export function EventCommandCentre({
  eventId,
  initialEvent,
  initialGates,
  initialKioskConfig,
}: {
  eventId: string;
  initialEvent: {
    name: string;
    slug: string;
    status: EventStatus;
    mode: EventMode;
    venueName: string;
    venueTimezone: string;
    startsAt: string;
    endsAt: string;
  };
  initialGates: GateRow[];
  initialKioskConfig: KioskConfigResolved;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const mutate = useMemo(() => canAdminWrite(session), [session]);

  const [status, setStatus] = useState<EventStatus>(initialEvent.status);
  const [gates, setGates] = useState<GateRow[]>(initialGates);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetricBundle | null>(null);
  const [streamOk, setStreamOk] = useState(true);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [pauseAllOpen, setPauseAllOpen] = useState(false);
  const [resumeAllOpen, setResumeAllOpen] = useState(false);
  const [bulkGateLoading, setBulkGateLoading] = useState(false);
  const [gateToggleLoading, setGateToggleLoading] = useState<string | null>(null);
  const [attemptOpen, setAttemptOpen] = useState(false);
  const [attemptLoading, setAttemptLoading] = useState(false);
  const [attemptDetail, setAttemptDetail] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [statusLoading, setStatusLoading] = useState<EventStatus | null>(null);

  const [kioskForm, setKioskForm] = useState<KioskConfigResolved>(initialKioskConfig);
  const [kioskSaving, setKioskSaving] = useState(false);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");

  useEffect(() => {
    setStatus(initialEvent.status);
  }, [initialEvent.status]);

  useEffect(() => {
    setKioskForm(initialKioskConfig);
  }, [initialKioskConfig]);

  useEffect(() => {
    const url = `/api/admin/events/${eventId}/stream`;
    const es = new EventSource(url);
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data as string) as {
          type?: string;
          data?: {
            checkedIn: number;
            enrolled: number;
            allowCount: number;
            denyCount: number;
            errorCount: number;
            uniqueReentered: number;
            activeDevices: number;
            gateHealth: GateHealthDevice[];
            attempts: Array<{
              id: string;
              attemptedAt: string;
              gateName: string;
              decision: Decision;
              decisionReason: string;
              guestName: string | null;
            }>;
          };
        };
        if (parsed.type !== "metrics" || !parsed.data) return;
        const d = parsed.data;
        setStreamOk(true);
        setLiveMetrics({
          checkedIn: d.checkedIn,
          enrolled: d.enrolled,
          allowCount: d.allowCount,
          denyCount: d.denyCount,
          errorCount: d.errorCount,
          uniqueReentered: d.uniqueReentered,
          activeDevices: d.activeDevices,
        });
        setGates((prev) => mergeGateDevices(prev, d.gateHealth));
        setAttempts(
          d.attempts.map((a) => ({
            id: a.id,
            decision: a.decision,
            decisionReason: a.decisionReason,
            attemptedAt: a.attemptedAt,
            gateName: a.gateName,
            guestName: a.guestName,
          }))
        );
      } catch {
        setStreamOk(false);
      }
    };
    es.onerror = () => {
      setStreamOk(false);
    };
    return () => {
      es.close();
    };
  }, [eventId]);

  async function patchStatus(next: EventStatus) {
    setStatusLoading(next);
    const res = await fetch(`/api/admin/events/${eventId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const json = await res.json();
    setStatusLoading(null);
    if (!res.ok || json.error) {
      toast.error(json.error ?? "Could not update status");
      return;
    }
    setStatus(json.data.event.status as EventStatus);
    toast.success("Status updated");
    router.refresh();
  }

  async function saveKioskConfig() {
    const transitioningPerEvent =
      kioskForm.consentMode === "per-event" &&
      initialKioskConfig.consentMode !== "per-event";

    setKioskSaving(true);
    const res = await fetch(`/api/admin/events/${eventId}/kiosk-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consentMode: kioskForm.consentMode,
        allowNameDisplay: kioskForm.allowNameDisplay,
        allowCopy: kioskForm.allowCopy,
        denyCopy: kioskForm.denyCopy,
        errorCopy: kioskForm.errorCopy,
        unavailableCopy: kioskForm.unavailableCopy,
        resetAfterMs: kioskForm.resetAfterMs,
        theme: kioskForm.theme,
        primaryColour: kioskForm.primaryColour,
        backgroundColour: kioskForm.backgroundColour,
        textColour: kioskForm.textColour,
        consentPerEventConfirmed: transitioningPerEvent ? true : undefined,
      }),
    });
    const json = await res.json();
    setKioskSaving(false);
    if (!res.ok || json.error) {
      toast.error(json.error ?? "Could not save kiosk configuration");
      return;
    }
    toast.success("Kiosk configuration saved");
    router.refresh();
  }

  function selectConsentMode(next: "per-guest" | "per-event") {
    if (
      next === "per-event" &&
      kioskForm.consentMode === "per-guest"
    ) {
      setConfirmPhrase("");
      setConsentDialogOpen(true);
      return;
    }
    setKioskForm((k) => ({ ...k, consentMode: next }));
  }

  function confirmPerEventConsent() {
    if (confirmPhrase.trim() !== "I CONFIRM") {
      toast.error('You must type exactly "I CONFIRM" to continue.');
      return;
    }
    setKioskForm((k) => ({ ...k, consentMode: "per-event" }));
    setConsentDialogOpen(false);
    setConfirmPhrase("");
    toast.message("Consent mode will apply when you save.");
  }

  async function patchAllGates(active: boolean) {
    setBulkGateLoading(true);
    const res = await fetch(`/api/admin/events/${eventId}/gates/all-active`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    const json = await res.json();
    setBulkGateLoading(false);
    setPauseAllOpen(false);
    setResumeAllOpen(false);
    if (!res.ok || json.error) {
      toast.error(json.error ?? "Could not update gates");
      return;
    }
    setGates((gs) => gs.map((g) => ({ ...g, isActive: active })));
    toast.success(active ? "All gates resumed" : "All gates paused");
  }

  async function patchGate(gateId: string, isGateActive: boolean) {
    setGateToggleLoading(gateId);
    const res = await fetch(`/api/admin/events/${eventId}/gates/${gateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: isGateActive }),
    });
    const json = await res.json();
    setGateToggleLoading(null);
    if (!res.ok || json.error) {
      toast.error(json.error ?? "Could not update gate");
      return;
    }
    setGates((gs) =>
      gs.map((g) => (g.id === gateId ? { ...g, isActive: isGateActive } : g))
    );
    toast.success(isGateActive ? "Gate resumed" : "Gate paused");
  }

  async function openAttemptDetail(id: string) {
    setAttemptOpen(true);
    setAttemptLoading(true);
    setAttemptDetail(null);
    const res = await fetch(`/api/admin/events/${eventId}/attempts/${id}`);
    const json = await res.json();
    setAttemptLoading(false);
    if (!res.ok || json.error) {
      toast.error(json.error ?? "Could not load attempt");
      setAttemptOpen(false);
      return;
    }
    setAttemptDetail(json.data.attempt as Record<string, unknown>);
  }

  const starts = new Date(initialEvent.startsAt);
  const ends = new Date(initialEvent.endsAt);

  return (
    <div className="space-y-8">
      <Card className="border-fg-line bg-fg-surface">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-2xl text-fg-ink">{initialEvent.name}</CardTitle>
              <EventStatusBadge status={status} />
              <EventModeBadge mode={initialEvent.mode} />
            </div>
            <p className="text-sm text-fg-mist">
              {initialEvent.venueName} · {initialEvent.venueTimezone}
            </p>
            <p className="text-sm text-fg-mist">
              {format(starts, "PPp")} — {format(ends, "PPp")}
            </p>
          </div>
          {mutate ? (
            <div className="flex flex-wrap gap-2">
              {status === EventStatus.DRAFT ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-fg-ready-text/40 text-fg-ready-text"
                  disabled={!!statusLoading}
                  onClick={() => void patchStatus(EventStatus.READY)}
                >
                  {statusLoading === EventStatus.READY ? "Updating…" : "Set READY"}
                </Button>
              ) : null}
              {status === EventStatus.READY ? (
                <Button
                  type="button"
                  size="sm"
                  className="bg-fg-gold text-fg-black hover:bg-fg-gold/90"
                  disabled={!!statusLoading}
                  onClick={() => void patchStatus(EventStatus.LIVE)}
                >
                  {statusLoading === EventStatus.LIVE ? "Updating…" : "Set LIVE"}
                </Button>
              ) : null}
              {status === EventStatus.LIVE ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="border-fg-danger-text bg-fg-danger text-fg-danger-text hover:bg-fg-danger/90"
                  disabled={!!statusLoading}
                  onClick={() => void patchStatus(EventStatus.CLOSED)}
                >
                  {statusLoading === EventStatus.CLOSED ? "Updating…" : "Set CLOSED"}
                </Button>
              ) : null}
              {status === EventStatus.CLOSED ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-fg-line text-fg-mist"
                  disabled={!!statusLoading}
                  onClick={() => void patchStatus(EventStatus.ARCHIVED)}
                >
                  {statusLoading === EventStatus.ARCHIVED ? "Updating…" : "Set ARCHIVED"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardHeader>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm" className="border-fg-line">
          <Link href={`/events/${eventId}/analytics`}>Analytics</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="border-fg-line">
          <Link href={`/events/${eventId}/attempts`}>Attempts</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="border-fg-line">
          <Link href={`/events/${eventId}/audit`}>Audit log</Link>
        </Button>
        {(status === EventStatus.CLOSED || status === EventStatus.ARCHIVED) &&
        mutate ? (
          <Button asChild variant="outline" size="sm" className="border-fg-danger/40">
            <Link href={`/events/${eventId}/deletion`}>Biometric deletion</Link>
          </Button>
        ) : null}
        <span className="text-xs text-fg-mist">
          Live stream {streamOk ? "connected" : "reconnecting…"}
        </span>
      </div>

      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-ink">Kiosk Configuration</CardTitle>
          <p className="text-sm text-fg-mist">
            Guest-facing copy and consent behaviour for gate tablets. Changes sync on the next kiosk
            heartbeat.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-fg-mist">Consent mode</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={kioskForm.consentMode === "per-guest" ? "default" : "outline"}
                className={
                  kioskForm.consentMode === "per-guest"
                    ? "bg-fg-gold text-fg-black hover:bg-fg-gold/90"
                    : "border-fg-line text-fg-mist"
                }
                disabled={!mutate || kioskSaving}
                onClick={() => selectConsentMode("per-guest")}
              >
                Per Guest
              </Button>
              <Button
                type="button"
                size="sm"
                variant={kioskForm.consentMode === "per-event" ? "default" : "outline"}
                className={
                  kioskForm.consentMode === "per-event"
                    ? "bg-fg-gold text-fg-black hover:bg-fg-gold/90"
                    : "border-fg-line text-fg-mist"
                }
                disabled={!mutate || kioskSaving}
                onClick={() => selectConsentMode("per-event")}
              >
                Per Event
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-fg-mist">Allow guest name on ALLOW decision</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={kioskForm.allowNameDisplay ? "default" : "outline"}
                className={
                  kioskForm.allowNameDisplay
                    ? "bg-fg-gold text-fg-black hover:bg-fg-gold/90"
                    : "border-fg-line text-fg-mist"
                }
                disabled={!mutate || kioskSaving}
                onClick={() =>
                  setKioskForm((k) => ({ ...k, allowNameDisplay: true }))
                }
              >
                Yes
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!kioskForm.allowNameDisplay ? "default" : "outline"}
                className={
                  !kioskForm.allowNameDisplay
                    ? "bg-fg-gold text-fg-black hover:bg-fg-gold/90"
                    : "border-fg-line text-fg-mist"
                }
                disabled={!mutate || kioskSaving}
                onClick={() =>
                  setKioskForm((k) => ({ ...k, allowNameDisplay: false }))
                }
              >
                No
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kiosk-allow" className="text-fg-mist">
                Custom ALLOW message
              </Label>
              <Textarea
                id="kiosk-allow"
                value={kioskForm.allowCopy}
                disabled={!mutate || kioskSaving}
                onChange={(e) =>
                  setKioskForm((k) => ({ ...k, allowCopy: e.target.value }))
                }
                className="border-fg-line bg-fg-elevated text-fg-ink"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kiosk-deny" className="text-fg-mist">
                Custom DENY message
              </Label>
              <Textarea
                id="kiosk-deny"
                value={kioskForm.denyCopy}
                disabled={!mutate || kioskSaving}
                onChange={(e) =>
                  setKioskForm((k) => ({ ...k, denyCopy: e.target.value }))
                }
                className="border-fg-line bg-fg-elevated text-fg-ink"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kiosk-error" className="text-fg-mist">
                Custom ERROR message
              </Label>
              <Textarea
                id="kiosk-error"
                value={kioskForm.errorCopy}
                disabled={!mutate || kioskSaving}
                onChange={(e) =>
                  setKioskForm((k) => ({ ...k, errorCopy: e.target.value }))
                }
                className="border-fg-line bg-fg-elevated text-fg-ink"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kiosk-unavail" className="text-fg-mist">
                Custom UNAVAILABLE message
              </Label>
              <Textarea
                id="kiosk-unavail"
                value={kioskForm.unavailableCopy}
                disabled={!mutate || kioskSaving}
                onChange={(e) =>
                  setKioskForm((k) => ({
                    ...k,
                    unavailableCopy: e.target.value,
                  }))
                }
                className="border-fg-line bg-fg-elevated text-fg-ink"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kiosk-reset" className="text-fg-mist">
              Reset timeout (milliseconds)
            </Label>
            <Input
              id="kiosk-reset"
              type="number"
              min={1000}
              max={120000}
              step={250}
              value={kioskForm.resetAfterMs}
              disabled={!mutate || kioskSaving}
              onChange={(e) =>
                setKioskForm((k) => ({
                  ...k,
                  resetAfterMs: Number(e.target.value) || k.resetAfterMs,
                }))
              }
              className="max-w-xs border-fg-line bg-fg-elevated text-fg-ink"
            />
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-fg-mist">Kiosk theme</Label>
              <p className="text-xs text-fg-mist">
                Controls kiosk background and accent colours. Changes propagate on the next device
                heartbeat.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["obsidian", "Obsidian"],
                  ["ivory", "Ivory"],
                  ["slate", "Slate"],
                  ["custom", "Custom"],
                ] as const
              ).map(([key, label]) => {
                const preset = KIOSK_THEME_PRESETS[key];
                const active = kioskForm.theme === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!mutate || kioskSaving}
                    onClick={() =>
                      setKioskForm((k) => ({
                        ...k,
                        theme: preset.theme,
                        backgroundColour:
                          key === "custom" ? k.backgroundColour : preset.backgroundColour,
                        primaryColour:
                          key === "custom" ? k.primaryColour : preset.primaryColour,
                        textColour: key === "custom" ? k.textColour : preset.textColour,
                      }))
                    }
                    className={[
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                      active
                        ? "border-fg-gold bg-fg-elevated text-fg-ink"
                        : "border-fg-line bg-fg-surface text-fg-mist hover:bg-fg-elevated hover:text-fg-ink",
                    ].join(" ")}
                    title={`${label} theme`}
                  >
                    <span
                      className="h-4 w-4 rounded-sm border border-fg-line"
                      style={{ background: preset.backgroundColour }}
                      aria-hidden
                    />
                    <span
                      className="h-4 w-4 rounded-sm border border-fg-line"
                      style={{ background: preset.primaryColour }}
                      aria-hidden
                    />
                    <span className="font-medium">{label}</span>
                  </button>
                );
              })}
            </div>

            {kioskForm.theme === "custom" ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="kiosk-bg" className="text-fg-mist">
                    Background colour
                  </Label>
                  <Input
                    id="kiosk-bg"
                    value={kioskForm.backgroundColour}
                    disabled={!mutate || kioskSaving}
                    onChange={(e) =>
                      setKioskForm((k) => ({
                        ...k,
                        backgroundColour: e.target.value,
                      }))
                    }
                    className="border-fg-line bg-fg-elevated font-mono text-fg-ink"
                    placeholder="#0A0A0A"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kiosk-accent" className="text-fg-mist">
                    Primary accent
                  </Label>
                  <Input
                    id="kiosk-accent"
                    value={kioskForm.primaryColour}
                    disabled={!mutate || kioskSaving}
                    onChange={(e) =>
                      setKioskForm((k) => ({
                        ...k,
                        primaryColour: e.target.value,
                      }))
                    }
                    className="border-fg-line bg-fg-elevated font-mono text-fg-ink"
                    placeholder="#b79f85"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kiosk-text" className="text-fg-mist">
                    Text colour
                  </Label>
                  <Input
                    id="kiosk-text"
                    value={kioskForm.textColour}
                    disabled={!mutate || kioskSaving}
                    onChange={(e) =>
                      setKioskForm((k) => ({
                        ...k,
                        textColour: e.target.value,
                      }))
                    }
                    className="border-fg-line bg-fg-elevated font-mono text-fg-ink"
                    placeholder="#F5F5F0"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {mutate ? (
            <Button
              type="button"
              className="bg-fg-gold text-fg-black hover:bg-fg-gold/90"
              disabled={kioskSaving}
              onClick={() => void saveKioskConfig()}
            >
              {kioskSaving ? "Saving…" : "Save kiosk configuration"}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-fg-ink">Gate health</h2>
        <div className="flex flex-wrap gap-2">
          {mutate ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-fg-line"
                disabled={bulkGateLoading || !gates.length}
                onClick={() => setPauseAllOpen(true)}
              >
                Pause all gates
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-fg-line"
                disabled={bulkGateLoading || !gates.length}
                onClick={() => setResumeAllOpen(true)}
              >
                Resume all gates
              </Button>
            </>
          ) : null}
          {mutate ? (
            <Button
              asChild
              size="sm"
              className="bg-fg-gold text-fg-black hover:bg-fg-gold/90"
            >
              <Link href={`/events/${eventId}/gates/new`}>Add Gate</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {gates.length === 0 ? (
          <Card className="border-fg-line border-dashed bg-fg-surface">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-fg-mist">
              <p>No gates configured for this event.</p>
              {mutate ? (
                <Button asChild variant="outline" className="border-fg-line">
                  <Link href={`/events/${eventId}/gates/new`}>Create the first gate</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          gates.map((gate) => (
            <Card key={gate.id} className="border-fg-line bg-fg-surface">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base text-fg-ink">{gate.name}</CardTitle>
                  <p className="text-xs text-fg-mist">
                    {gate.code} · {gate.gateType}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="outline" className="border-fg-line text-fg-mist">
                    {gate.devices.length} devices
                  </Badge>
                  {!gate.isActive ? (
                    <Badge className="bg-fg-danger/30 text-fg-danger-text">Paused</Badge>
                  ) : null}
                  {mutate ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-fg-line text-xs"
                      disabled={gateToggleLoading === gate.id}
                      onClick={() =>
                        void patchGate(gate.id, !gate.isActive)
                      }
                    >
                      {gateToggleLoading === gate.id
                        ? "…"
                        : gate.isActive
                          ? "Pause gate"
                          : "Resume gate"}
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {gate.devices.length === 0 ? (
                  <p className="text-sm text-fg-mist">No devices on this gate.</p>
                ) : (
                  <ul className="space-y-2">
                    {gate.devices.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between rounded-md border border-fg-line bg-fg-elevated px-3 py-2 text-sm"
                      >
                        <span className="font-mono text-xs text-fg-ink">{d.devicePublicId}</span>
                        <span className="flex items-center gap-2 text-fg-mist">
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded-full ${devicePulseClass(d.lastSeenAt)}`}
                            title="Heartbeat recency"
                          />
                          {d.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {mutate ? (
                  <Button asChild variant="outline" size="sm" className="border-fg-line">
                    <Link href={`/events/${eventId}/devices/new?gateId=${gate.id}`}>
                      Add device
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {(
          [
            ["Checked in", liveMetrics?.checkedIn ?? "—"],
            ["Enrolled", liveMetrics?.enrolled ?? "—"],
            ["Allow", liveMetrics?.allowCount ?? "—"],
            ["Deny", liveMetrics?.denyCount ?? "—"],
            ["Error", liveMetrics?.errorCount ?? "—"],
            ["Unique re-entry", liveMetrics?.uniqueReentered ?? "—"],
            ["Active devices", liveMetrics?.activeDevices ?? "—"],
          ] as const
        ).map(([label, value]) => (
          <Card key={label} className="border-fg-line bg-fg-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-fg-mist">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-fg-ink">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-ink">Recent re-entry attempts</CardTitle>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-fg-mist">
              <p>No attempts recorded yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-fg-line hover:bg-transparent">
                  <TableHead className="text-fg-mist">Gate</TableHead>
                  <TableHead className="text-fg-mist">Guest</TableHead>
                  <TableHead className="text-fg-mist">Decision</TableHead>
                  <TableHead className="text-fg-mist">Reason</TableHead>
                  <TableHead className="text-fg-mist">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer border-fg-line hover:bg-fg-elevated/60"
                    onClick={() => void openAttemptDetail(a.id)}
                  >
                    <TableCell className="text-fg-ink">{a.gateName}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-fg-mist">
                      {a.guestName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <DecisionBadge decision={a.decision} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-fg-mist">
                      {a.decisionReason}
                    </TableCell>
                    <TableCell className="text-fg-mist">
                      {formatDistanceToNow(new Date(a.attemptedAt), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {status === EventStatus.CLOSED || status === EventStatus.ARCHIVED ? (
        <Card className="border-fg-danger/40 bg-fg-danger/20">
          <CardHeader>
            <CardTitle className="text-fg-danger-text">Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-fg-mist">
              Biometric deletion runs provider workflows, soft-deletes enrollments, and issues an
              audit trail. Use the dedicated deletion workspace when you are ready.
            </p>
            {mutate ? (
              <Button
                asChild
                variant="destructive"
                className="border-fg-danger-text bg-fg-danger text-fg-danger-text"
              >
                <Link href={`/events/${eventId}/deletion`}>Open biometric deletion</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={consentDialogOpen} onOpenChange={setConsentDialogOpen}>
        <DialogContent className="border-fg-line bg-fg-surface text-fg-ink">
          <DialogHeader>
            <DialogTitle>Confirm Per Event consent</DialogTitle>
            <DialogDescription className="text-fg-mist">
              By selecting Per Event consent, you confirm that{" "}
              <span className="font-medium text-fg-ink">{initialEvent.name}</span> has obtained
              appropriate consent from all guests for biometric processing at this event. This
              approval is logged against your account once you save.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-phrase" className="text-fg-mist">
              Type I CONFIRM
            </Label>
            <Input
              id="confirm-phrase"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              className="border-fg-line bg-fg-elevated font-mono text-sm text-fg-ink"
              placeholder="I CONFIRM"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-fg-line"
              onClick={() => {
                setConsentDialogOpen(false);
                setConfirmPhrase("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-fg-gold text-fg-black hover:bg-fg-gold/90"
              onClick={confirmPerEventConsent}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={attemptOpen} onOpenChange={setAttemptOpen}>
        <DialogContent className="border-fg-line bg-fg-surface text-fg-ink">
          <DialogHeader>
            <DialogTitle>Attempt detail</DialogTitle>
            <DialogDescription className="text-fg-mist">
              Full gate and guest context for this re-entry attempt.
            </DialogDescription>
          </DialogHeader>
          {attemptLoading ? (
            <p className="text-sm text-fg-mist">Loading…</p>
          ) : attemptDetail ? (
            <pre className="max-h-72 overflow-auto rounded-md border border-fg-line bg-fg-elevated p-3 text-xs text-fg-mist">
              {JSON.stringify(attemptDetail, null, 2)}
            </pre>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-fg-line"
              onClick={() => setAttemptOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pauseAllOpen} onOpenChange={setPauseAllOpen}>
        <DialogContent className="border-fg-line bg-fg-surface text-fg-ink">
          <DialogHeader>
            <DialogTitle>Pause all gates?</DialogTitle>
            <DialogDescription className="text-fg-mist">
              Scanners will stop admitting guests until gates are resumed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-fg-line"
              onClick={() => setPauseAllOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={bulkGateLoading}
              onClick={() => void patchAllGates(false)}
            >
              {bulkGateLoading ? "Updating…" : "Pause all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resumeAllOpen} onOpenChange={setResumeAllOpen}>
        <DialogContent className="border-fg-line bg-fg-surface text-fg-ink">
          <DialogHeader>
            <DialogTitle>Resume all gates?</DialogTitle>
            <DialogDescription className="text-fg-mist">
              Restores normal scanning on every gate for this event.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-fg-line"
              onClick={() => setResumeAllOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-fg-gold text-fg-black hover:bg-fg-gold/90"
              disabled={bulkGateLoading}
              onClick={() => void patchAllGates(true)}
            >
              {bulkGateLoading ? "Updating…" : "Resume all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
