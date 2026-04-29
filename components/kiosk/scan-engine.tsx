"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EventMode, EventStatus } from "@prisma/client";
import type { KioskConfigResolved } from "@/lib/kiosk-config";
import { cn } from "@/lib/utils";
import { KioskSetupScreen } from "@/components/kiosk/setup-screen";
import { KioskIdleState } from "@/components/kiosk/states/idle";
import { KioskProcessingState } from "@/components/kiosk/states/processing";
import { KioskAllowState } from "@/components/kiosk/states/allow";
import { KioskDenyState } from "@/components/kiosk/states/deny";
import { KioskErrorState } from "@/components/kiosk/states/error";
import { KioskUnavailableState } from "@/components/kiosk/states/unavailable";
import { KioskStandbyState } from "@/components/kiosk/states/standby";
import { KioskGatePausedState } from "@/components/kiosk/states/gate-paused";
import { KioskEnrollInviteState } from "@/components/kiosk/states/enroll-invite";

type UiPhase =
  | "loading"
  | "setup"
  | "init_error"
  | "standby"
  | "gate_paused"
  | "idle"
  | "processing"
  | "allow"
  | "deny"
  | "error"
  | "unavailable"
  | "enroll_invite";

function storageKey(devicePublicId: string) {
  return `fg-kiosk-secret:${devicePublicId}`;
}

function basic(devicePublicId: string, secret: string) {
  return `Basic ${typeof window !== "undefined" ? btoa(`${devicePublicId}:${secret}`) : ""}`;
}

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 5000, ...rest } = init;
  const controller = new AbortController();
  const tid = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    window.clearTimeout(tid);
  }
}

export function KioskScanEngine({ devicePublicId }: { devicePublicId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanLockRef = useRef(false);
  const phaseRef = useRef<UiPhase>("loading");
  const enrollCycleRef = useRef(0);

  const [secret, setSecret] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);

  const [phase, setPhase] = useState<UiPhase>("loading");
  const [initMessage, setInitMessage] = useState<string | null>(null);

  const [eventName, setEventName] = useState("");
  const [gateName, setGateName] = useState("");
  const [eventMode, setEventMode] = useState<EventMode>(EventMode.INTEGRATED);

  const [kioskConfig, setKioskConfig] = useState<KioskConfigResolved | null>(null);

  const [allowName, setAllowName] = useState<string | undefined>(undefined);

  const failureRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    setBooted(true);
    setSecret(sessionStorage.getItem(storageKey(devicePublicId)));
  }, [devicePublicId]);

  const applyInitPayload = useCallback(
    (payload: {
      eventName: string;
      gateName: string;
      eventStatus: EventStatus;
      gateActive: boolean;
      mode: EventMode;
      kioskConfig: KioskConfigResolved;
    }) => {
      setEventName(payload.eventName);
      setGateName(payload.gateName);
      setEventMode(payload.mode);
      setKioskConfig(payload.kioskConfig);
    },
    []
  );

  const loadInit = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetchWithTimeout(
        `/api/kiosk/init?deviceToken=${encodeURIComponent(devicePublicId)}`,
        { timeoutMs: 5000 }
      );
      const json = (await res.json()) as {
        data:
          | { ok: false; code: string }
          | {
              ok: true;
              eventName: string;
              gateName: string;
              eventStatus: EventStatus;
              gateActive: boolean;
              mode: EventMode;
              kioskConfig: KioskConfigResolved;
            };
        error: string | null;
      };

      if (!res.ok || json.error) {
        failureRef.current += 1;
        if (failureRef.current >= 3) {
          setPhase("unavailable");
        }
        return false;
      }

      const data = json.data;
      if (!data || typeof data !== "object") {
        failureRef.current += 1;
        if (failureRef.current >= 3) {
          setPhase("unavailable");
        }
        return false;
      }

      if ("ok" in data && data.ok === false) {
        setInitMessage(
          "This device is not authorised. Please contact your event administrator."
        );
        setPhase("init_error");
        return false;
      }

      if (!("ok" in data) || !data.ok) {
        failureRef.current += 1;
        if (failureRef.current >= 3) {
          setPhase("unavailable");
        }
        return false;
      }

      failureRef.current = 0;
      applyInitPayload(data);

      if (data.eventStatus !== EventStatus.LIVE) {
        setPhase("standby");
        return true;
      }

      if (!data.gateActive) {
        setPhase("gate_paused");
        return true;
      }

      setPhase("idle");
      return true;
    } catch {
      failureRef.current += 1;
      if (failureRef.current >= 3) {
        setPhase("unavailable");
      }
      return false;
    }
  }, [applyInitPayload, devicePublicId]);

  useEffect(() => {
    if (!booted) return;
    if (!secret) {
      setPhase("setup");
      return;
    }
    setPhase("loading");
    void loadInit();
  }, [booted, secret, loadInit]);

  useEffect(() => {
    if (phase !== "loading" || !secret) return;
    const id = window.setInterval(() => void loadInit(), 3000);
    return () => window.clearInterval(id);
  }, [phase, secret, loadInit]);

  useEffect(() => {
    if (phase !== "standby" || !secret) return;
    const id = window.setInterval(() => void loadInit(), 30_000);
    return () => window.clearInterval(id);
  }, [phase, secret, loadInit]);

  useEffect(() => {
    if (phase !== "gate_paused" || !secret) return;
    const id = window.setInterval(() => void loadInit(), 10_000);
    return () => window.clearInterval(id);
  }, [phase, secret, loadInit]);

  useEffect(() => {
    if (phase !== "unavailable") return;
    const id = window.setInterval(() => void loadInit(), 10_000);
    return () => window.clearInterval(id);
  }, [phase, loadInit]);

  const sendHeartbeat = useCallback(async () => {
    if (!secret) return;
    try {
      const res = await fetchWithTimeout(
        `/api/kiosk/heartbeat?deviceToken=${encodeURIComponent(devicePublicId)}`,
        {
          method: "POST",
          headers: { Authorization: basic(devicePublicId, secret) },
          timeoutMs: 5000,
        }
      );
      const json = (await res.json()) as {
        data: {
          eventStatus: EventStatus;
          gateActive: boolean;
          kioskConfig: KioskConfigResolved;
        } | null;
        error: string | null;
      };
      if (!res.ok || json.error || !json.data) {
        failureRef.current += 1;
        if (
          failureRef.current >= 3 &&
          (phaseRef.current === "idle" || phaseRef.current === "processing")
        ) {
          setPhase("unavailable");
        }
        return;
      }

      failureRef.current = 0;
      setKioskConfig(json.data.kioskConfig);

      const st = json.data.eventStatus;
      const liveGateIdleEligible =
        st === EventStatus.LIVE && json.data.gateActive;

      if (
        st !== EventStatus.LIVE &&
        phaseRef.current !== "standby" &&
        phaseRef.current !== "loading" &&
        phaseRef.current !== "setup" &&
        phaseRef.current !== "init_error" &&
        st !== EventStatus.READY
      ) {
        setPhase("unavailable");
        return;
      }

      if (st === EventStatus.READY || st === EventStatus.DRAFT) {
        if (
          phaseRef.current === "idle" ||
          phaseRef.current === "processing"
        ) {
          setPhase("standby");
        }
      }

      if (!liveGateIdleEligible && st === EventStatus.LIVE && phaseRef.current === "idle") {
        setPhase("gate_paused");
      }

      if (
        liveGateIdleEligible &&
        (phaseRef.current === "gate_paused" || phaseRef.current === "standby")
      ) {
        setPhase("idle");
      }
    } catch {
      failureRef.current += 1;
      if (
        failureRef.current >= 3 &&
        (phaseRef.current === "idle" || phaseRef.current === "processing")
      ) {
        setPhase("unavailable");
      }
    }
  }, [devicePublicId, secret]);

  useEffect(() => {
    if (!secret) return;
    void sendHeartbeat();
    const id = window.setInterval(() => void sendHeartbeat(), 60_000);
    return () => window.clearInterval(id);
  }, [secret, sendHeartbeat]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return dataUrl.replace(/^data:image\/jpeg;base64,/, "");
  }, []);

  const captureProcessingDelay = useCallback(async (started: number) => {
    const elapsed = Date.now() - started;
    const wait = Math.min(500, Math.max(0, 500 - elapsed));
    await new Promise((r) => window.setTimeout(r, wait));
  }, []);

  const submitAttempt = useCallback(async () => {
    if (!secret || !kioskConfig) return;
    const imageBase64 = captureFrame();
    if (!imageBase64) return;

    const clientRequestId = crypto.randomUUID();
    const started = Date.now();
    scanLockRef.current = true;
    setPhase("processing");

    try {
      const res = await fetchWithTimeout("/api/kiosk/attempt", {
        method: "POST",
        headers: {
          Authorization: basic(devicePublicId, secret),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientRequestId,
          imageBase64,
          capturedAt: new Date().toISOString(),
        }),
        timeoutMs: 5000,
      });

      const json = (await res.json()) as {
        data: {
          decision: "ALLOW" | "DENY" | "ERROR";
          reasonCode: string;
          displayName?: string;
          resetAfterMs: number;
        } | null;
        error: string | null;
      };

      await captureProcessingDelay(started);

      if (!res.ok || json.error || !json.data) {
        failureRef.current += 1;
        if (failureRef.current >= 3) {
          setPhase("unavailable");
        } else {
          setPhase("idle");
        }
        return;
      }

      failureRef.current = 0;

      const { decision, reasonCode, displayName, resetAfterMs } = json.data;

      setKioskConfig((prev) =>
        prev ? { ...prev, resetAfterMs } : prev
      );

      if (decision === "ALLOW") {
        setAllowName(displayName);
        setPhase("allow");
        return;
      }

      if (decision === "ERROR") {
        setPhase("error");
        return;
      }

      if (
        reasonCode === "NO_BIOMETRIC_MATCH" &&
        eventMode === EventMode.STANDALONE
      ) {
        enrollCycleRef.current += 1;
        setPhase("enroll_invite");
        return;
      }

      setPhase("deny");
    } catch {
      failureRef.current += 1;
      await captureProcessingDelay(started);
      if (failureRef.current >= 3) {
        setPhase("unavailable");
      } else {
        setPhase("idle");
      }
    } finally {
      scanLockRef.current = false;
    }
  }, [
    captureFrame,
    captureProcessingDelay,
    devicePublicId,
    eventMode,
    kioskConfig,
    secret,
  ]);

  useEffect(() => {
    if (phase !== "idle" || !secret) return;
    const id = window.setInterval(() => {
      if (scanLockRef.current) return;
      void submitAttempt();
    }, 1500);
    return () => window.clearInterval(id);
  }, [phase, secret, submitAttempt]);

  useEffect(() => {
    const keepCamera =
      phase === "idle" ||
      phase === "processing" ||
      phase === "allow" ||
      phase === "deny" ||
      phase === "error" ||
      phase === "enroll_invite";

    if (!keepCamera) {
      return;
    }

    let stream: MediaStream | null = null;
    let attachedVideo: HTMLVideoElement | null = null;

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        const el = videoRef.current;
        if (el) {
          attachedVideo = el;
          el.srcObject = stream;
          await el.play().catch(() => undefined);
        }
      } catch {
        failureRef.current += 1;
      }
    })();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (attachedVideo) attachedVideo.srcObject = null;
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "enroll_invite" || !secret || !kioskConfig) return;

    const cycle = enrollCycleRef.current;
    const id = window.setTimeout(() => {
      void (async () => {
        if (cycle !== enrollCycleRef.current) return;

        const imageBase64 = captureFrame();
        if (!imageBase64) {
          setPhase("error");
          return;
        }

        const clientRequestId = crypto.randomUUID();
        const started = Date.now();
        setPhase("processing");

        try {
          const res = await fetchWithTimeout("/api/kiosk/enroll-walkin", {
            method: "POST",
            headers: {
              Authorization: basic(devicePublicId, secret),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              clientRequestId,
              imageBase64,
              capturedAt: new Date().toISOString(),
            }),
            timeoutMs: 5000,
          });
          const json = (await res.json()) as {
            data: {
              decision: "ALLOW" | "DENY" | "ERROR";
              reasonCode: string;
              displayName?: string;
              resetAfterMs: number;
            } | null;
            error: string | null;
          };

          await captureProcessingDelay(started);

          if (!res.ok || json.error || !json.data) {
            setPhase("error");
            return;
          }

          if (json.data.decision === "ALLOW") {
            setAllowName(json.data.displayName);
            setPhase("allow");
            return;
          }
          if (json.data.decision === "ERROR") {
            setPhase("error");
            return;
          }
          setPhase("deny");
        } catch {
          await captureProcessingDelay(started);
          setPhase("error");
        }
      })();
    }, 2000);

    return () => window.clearTimeout(id);
  }, [phase, secret, kioskConfig, captureFrame, captureProcessingDelay, devicePublicId]);

  const resetToIdle = useCallback(() => {
    setPhase("idle");
    setAllowName(undefined);
  }, []);

  if (!booted) {
    return <div className="h-full min-h-[100dvh] w-full bg-[#0A0A0A]" />;
  }

  if (!secret) {
    return (
      <KioskSetupScreen
        devicePublicId={devicePublicId}
        onActivated={(s) => {
          setSecret(s);
        }}
      />
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex h-full min-h-[100dvh] flex-col items-center justify-center bg-[#0A0A0A]">
        <div className="h-14 w-14 animate-spin rounded-full border-2 border-fg-gold/25 border-t-fg-gold/90" />
      </div>
    );
  }

  if (phase === "init_error") {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <p className="max-w-md text-lg text-fg-ink">{initMessage}</p>
      </div>
    );
  }

  const cfg = kioskConfig;

  const idleVisible =
    phase === "idle" || phase === "processing" || phase === "enroll_invite";

  return (
    <div className="relative h-full min-h-[100dvh] w-full bg-[#0A0A0A] text-fg-ink">
      <div
        className={cn(
          "absolute inset-0 z-0 transition-opacity duration-300",
          idleVisible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <KioskIdleState
          eventName={eventName || "—"}
          gateName={gateName || "—"}
          videoSlot={
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              playsInline
              muted
              autoPlay
            />
          }
        />
      </div>

      {phase === "processing" ? (
        <div className="absolute inset-0 z-20 bg-[#0A0A0A]/85">
          <KioskProcessingState />
        </div>
      ) : null}

      {phase === "standby" ? (
        <div className="absolute inset-0 z-30 bg-[#0A0A0A]">
          <KioskStandbyState eventName={eventName || "—"} />
        </div>
      ) : null}

      {phase === "gate_paused" ? (
        <div className="absolute inset-0 z-30 bg-[#0A0A0A]">
          <KioskGatePausedState eventName={eventName || "—"} gateName={gateName || "—"} />
        </div>
      ) : null}

      {phase === "unavailable" ? (
        <div className="absolute inset-0 z-30 bg-[#0A0A0A]">
          <KioskUnavailableState
            eventName={eventName || "—"}
            gateName={gateName || "—"}
            unavailableCopy={cfg?.unavailableCopy ?? "Please see our staff at the main entrance."}
          />
        </div>
      ) : null}

      {phase === "enroll_invite" ? (
        <div className="absolute inset-0 z-25 bg-[#0A0A0A]/90">
          <KioskEnrollInviteState />
        </div>
      ) : null}

      {phase === "allow" && cfg ? (
        <div className="absolute inset-0 z-40">
          <KioskAllowState
            allowCopy={cfg.allowCopy}
            displayName={allowName}
            gateName={gateName || "—"}
            resetAfterMs={cfg.resetAfterMs}
            onDone={resetToIdle}
          />
        </div>
      ) : null}

      {phase === "deny" && cfg ? (
        <div className="absolute inset-0 z-40 bg-[#0A0A0A]">
          <KioskDenyState denyCopy={cfg.denyCopy} resetAfterMs={cfg.resetAfterMs} onDone={resetToIdle} />
        </div>
      ) : null}

      {phase === "error" && cfg ? (
        <div className="absolute inset-0 z-40 bg-[#0A0A0A]">
          <KioskErrorState
            errorCopy={cfg.errorCopy}
            resetAfterMs={cfg.resetAfterMs}
            onDone={resetToIdle}
          />
        </div>
      ) : null}
    </div>
  );
}
