"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EventStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";

type CheckStatus = "pending" | "pass" | "fail";

type Row = {
  key: string;
  title: string;
  status: CheckStatus;
  detail: string;
};

function storageKey(devicePublicId: string) {
  return `fg-kiosk-secret:${devicePublicId}`;
}

function basic(devicePublicId: string, secret: string) {
  return `Basic ${typeof window !== "undefined" ? btoa(`${devicePublicId}:${secret}`) : ""}`;
}

function pendingRows(): Row[] {
  return [
    { key: "cam", title: "Camera access", status: "pending", detail: "Checking…" },
    { key: "prov", title: "Biometric provider ready", status: "pending", detail: "Checking…" },
    { key: "lat", title: "Backend reachable", status: "pending", detail: "Checking…" },
    { key: "auth", title: "Device authenticated", status: "pending", detail: "Checking…" },
    { key: "ev", title: "Event status", status: "pending", detail: "Checking…" },
    { key: "gate", title: "Gate active", status: "pending", detail: "Checking…" },
  ];
}

export default function KioskDiagnosticPage({
  params,
}: {
  params: { deviceToken: string };
}) {
  const devicePublicId = params.deviceToken;

  const [rows, setRows] = useState<Row[]>(pendingRows);

  const patchRow = useCallback((key: string, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }, []);

  const runChecks = useCallback(async () => {
    setRows(pendingRows());

    let camOk = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      stream.getTracks().forEach((t) => t.stop());
      camOk = true;
      patchRow("cam", {
        status: "pass",
        detail: "Live preview stream acquired.",
      });
    } catch {
      patchRow("cam", {
        status: "fail",
        detail: "Allow camera access in browser settings, then re-run.",
      });
    }

    try {
      const pr = await fetch("/api/kiosk/provider-status");
      const pj = (await pr.json()) as {
        data: { ready: boolean } | null;
        error: string | null;
      };
      const ok = !!(pr.ok && pj.data?.ready);
      patchRow("prov", {
        status: ok ? "pass" : "fail",
        detail: ok ? "GET /api/kiosk/provider-status returned ready=true." : "ready=false or endpoint error.",
      });
    } catch {
      patchRow("prov", {
        status: "fail",
        detail: "Could not reach provider status endpoint.",
      });
    }

    const secret =
      typeof window !== "undefined"
        ? sessionStorage.getItem(storageKey(devicePublicId))
        : null;

    if (!secret) {
      patchRow("lat", {
        status: "fail",
        detail: "Activate the gate once from the main kiosk URL so this tab has an access code.",
      });
      patchRow("auth", { status: "fail", detail: "No stored secret for this tab." });
      patchRow("ev", { status: "fail", detail: "—" });
      patchRow("gate", { status: "fail", detail: "—" });
      return;
    }

    const hbStarted = Date.now();
    try {
      const hb = await fetch(
        `/api/kiosk/heartbeat?deviceToken=${encodeURIComponent(devicePublicId)}`,
        {
          method: "POST",
          headers: { Authorization: basic(devicePublicId, secret) },
          signal: AbortSignal.timeout(2000),
        }
      );
      const ms = Date.now() - hbStarted;
      const json = (await hb.json()) as {
        data: {
          eventStatus: EventStatus;
          gateActive: boolean;
        } | null;
        error: string | null;
      };

      patchRow("lat", {
        status: hb.ok && ms <= 2000 ? "pass" : "fail",
        detail: hb.ok && ms <= 2000 ? `Heartbeat in ${ms}ms.` : `Slow or failed (${ms}ms).`,
      });

      patchRow("auth", {
        status: hb.ok ? "pass" : "fail",
        detail: hb.ok ? "Heartbeat returned 200." : "Verify device access code.",
      });

      if (hb.ok && json.data) {
        const okEv =
          json.data.eventStatus === EventStatus.LIVE ||
          json.data.eventStatus === EventStatus.READY;
        patchRow("ev", {
          status: okEv ? "pass" : "fail",
          detail: okEv
            ? `eventStatus=${json.data.eventStatus}`
            : `eventStatus=${json.data.eventStatus}`,
        });
        patchRow("gate", {
          status: json.data.gateActive ? "pass" : "fail",
          detail: json.data.gateActive ? "Gate is active." : "Activate gate in admin.",
        });
      }
    } catch {
      patchRow("lat", {
        status: "fail",
        detail: "No response within 2000ms.",
      });
      patchRow("auth", { status: "fail", detail: "Heartbeat failed." });
      patchRow("ev", { status: "fail", detail: "—" });
      patchRow("gate", { status: "fail", detail: "—" });
    }

    if (!camOk) {
      patchRow("cam", {
        status: "fail",
        detail: "Allow camera access in browser settings, then re-run.",
      });
    }
  }, [devicePublicId, patchRow]);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const allPass = useMemo(
    () => rows.length > 0 && rows.every((r) => r.status === "pass"),
    [rows]
  );
  const failed = useMemo(
    () => rows.filter((r) => r.status === "fail"),
    [rows]
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#0A0A0A] px-6 py-10 text-fg-ink">
      <div className="mx-auto w-full max-w-lg space-y-8">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-fg-mist">Gate diagnostic</p>
          <h1 className="text-2xl font-semibold text-fg-ink">Pre-open checklist</h1>
          <p className="text-sm text-fg-mist">
            Device{" "}
            <span className="font-mono text-fg-gold">{devicePublicId}</span>
          </p>
        </div>

        <ul className="space-y-4">
          {rows.map((it) => (
            <li
              key={it.key}
              className="flex gap-3 rounded-lg border border-fg-line bg-fg-surface px-4 py-3"
            >
              <span
                className={
                  it.status === "pass"
                    ? "mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-fg-gold"
                    : it.status === "fail"
                      ? "mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500/90"
                      : "mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-fg-mist/40"
                }
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium text-fg-ink">{it.title}</p>
                <p className="text-sm text-fg-mist">{it.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-4 rounded-lg border border-fg-line bg-fg-elevated p-6 text-center">
          {allPass ? (
            <>
              <p className="text-2xl font-semibold text-fg-gold">Gate Ready</p>
              <p className="text-sm text-fg-mist">All checks passed.</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-semibold text-red-400/90">Gate Not Ready</p>
              {failed.length ? (
                <ul className="mt-2 space-y-1 text-left text-sm text-fg-mist">
                  {failed.map((f) => (
                    <li key={f.key}>• {f.title}</li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="bg-fg-gold text-fg-black hover:bg-fg-gold/90"
            onClick={() => void runChecks()}
          >
            Re-run Checks
          </Button>
          <Button type="button" variant="outline" className="border-fg-line text-fg-ink" asChild>
            <Link href={`/kiosk/${devicePublicId}`}>Return to Gate</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
