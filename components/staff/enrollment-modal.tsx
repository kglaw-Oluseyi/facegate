"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { StaffRole } from "@prisma/client";

type Step = "consent" | "camera" | "preview" | "processing" | "done" | "error";

export function EnrollmentModal(props: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  guestId: string;
  guestName: string | null;
  onCompleted: () => void;
}) {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [step, setStep] = useState<Step>("consent");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const [conflict, setConflict] = useState<{
    conflictingEnrollmentId: string;
    conflictingGuestName: string;
    conflictingGuestId: string;
  } | null>(null);

  const resetStreams = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }, [stream]);

  useEffect(() => {
    if (!props.open) {
      resetStreams();
      setStep("consent");
      setErrorMsg(null);
      setPreviewUrl(null);
      setImageBase64(null);
      setConflict(null);
    }
  }, [props.open, resetStreams]);

  useEffect(() => {
    if (!stream || !videoRef.current) return;
    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch(() => undefined);
  }, [stream]);

  async function startCamera() {
    setErrorMsg(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setStream(s);
      setStep("camera");
    } catch (e) {
      const name = e && typeof e === "object" && "name" in e ? String((e as DOMException).name) : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setErrorMsg(
          "Camera access is required for enrolment. Please allow camera access in your browser settings."
        );
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setErrorMsg("No camera detected on this device.");
      } else {
        setErrorMsg("Camera unavailable. Please try again or contact your supervisor.");
      }
      setStep("error");
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
    setImageBase64(base64);
    setPreviewUrl(dataUrl);
    resetStreams();
    setStep("preview");
  }

  async function submitEnrollment() {
    if (!imageBase64) return;
    setStep("processing");
    setConflict(null);
    setErrorMsg(null);

    const res = await fetch("/api/staff/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestId: props.guestId,
        eventId: props.eventId,
        imageBase64,
      }),
    });

    const json = await res.json();

    if (res.status === 409 && json.error === "ENROLLMENT_CONFLICT") {
      setConflict({
        conflictingEnrollmentId: json.data.conflictingEnrollmentId,
        conflictingGuestName: json.data.conflictingGuestName,
        conflictingGuestId: json.data.conflictingGuestId,
      });
      setStep("processing");
      return;
    }

    if (!res.ok || json.error) {
      setErrorMsg(typeof json.error === "string" ? json.error : "Enrolment failed");
      setStep("error");
      return;
    }

    setStep("done");
    props.onCompleted();
  }

  async function resolveTransfer() {
    if (!imageBase64 || !conflict) return;
    const res = await fetch("/api/staff/enroll/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestId: props.guestId,
        eventId: props.eventId,
        conflictingEnrollmentId: conflict.conflictingEnrollmentId,
        imageBase64,
      }),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      setErrorMsg(typeof json.error === "string" ? json.error : "Transfer failed");
      setStep("error");
      return;
    }
    setConflict(null);
    setStep("done");
    props.onCompleted();
  }

  const canSupervise =
    role === StaffRole.SUPERVISOR ||
    role === StaffRole.ADMIN ||
    role === StaffRole.PLATFORM_ADMIN;

  return (
    <Dialog open={props.open} onOpenChange={(v) => (!v ? props.onClose() : undefined)}>
      <DialogContent className="flex max-h-[100dvh] w-full max-w-[100vw] flex-col overflow-y-auto border-fg-line bg-fg-surface p-0 text-fg-ink sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg">
        <div className="p-6">
          {step === "consent" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-fg-ink">Biometric enrolment</DialogTitle>
                <DialogDescription className="text-left text-fg-mist">
                  We use a secure biometric identifier to enable faster re-entry at this event. No
                  photograph is stored. Your identifier is used only for this event and will be
                  permanently deleted when the event ends.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-6 flex-col gap-2 sm:flex-col">
                <Button
                  type="button"
                  className="w-full bg-fg-gold text-fg-black hover:bg-fg-gold/90"
                  onClick={() => void startCamera()}
                >
                  Continue to Enrolment
                </Button>
                <Button type="button" variant="outline" className="w-full border-fg-line" onClick={props.onClose}>
                  Cancel
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {step === "camera" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-fg-ink">Capture face</DialogTitle>
              </DialogHeader>
              <div className="relative mx-auto mt-4 aspect-[4/3] w-full max-w-md overflow-hidden rounded-xl border-2 border-fg-gold/40 bg-black">
                <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-8 rounded-[50%] border border-white/20 shadow-[inset_0_0_80px_rgba(201,168,76,0.15)]" />
              </div>
              <p className="mt-4 text-center text-sm text-fg-mist">
                Position your face within the guide and hold still
              </p>
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  className="w-full bg-fg-gold px-8 py-6 text-lg text-fg-black hover:bg-fg-gold/90"
                  onClick={() => captureFrame()}
                >
                  Capture
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {step === "preview" && previewUrl ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-fg-ink">Confirm capture</DialogTitle>
              </DialogHeader>
              {/* eslint-disable-next-line @next/next/no-img-element -- ephemeral canvas data URL */}
            <img src={previewUrl} alt="Captured" className="mt-4 max-h-72 w-full rounded-lg object-contain" />
              <DialogFooter className="mt-6 flex-col gap-2 sm:flex-col">
                <Button
                  type="button"
                  className="w-full bg-fg-gold text-fg-black"
                  onClick={() => void submitEnrollment()}
                >
                  Use this photo
                </Button>
                <Button type="button" variant="outline" className="w-full border-fg-line" onClick={startCamera}>
                  Retake
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {step === "processing" && !conflict ? (
            <div className="flex flex-col items-center gap-4 py-16">
              <Loader2 className="h-10 w-10 animate-spin text-fg-gold" />
              <p className="text-sm text-fg-mist">Enrolling…</p>
            </div>
          ) : null}

          {step === "processing" && conflict ? (
            <div className="space-y-4 py-4">
              <DialogHeader>
                <DialogTitle className="text-fg-ink">Face conflict</DialogTitle>
                <DialogDescription className="text-left text-fg-mist">
                  This face is already enrolled for{" "}
                  <span className="font-medium text-fg-ink">{conflict.conflictingGuestName}</span>.
                  A supervisor must resolve this before enrolment can continue.
                </DialogDescription>
              </DialogHeader>
              {canSupervise ? (
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-fg-line"
                    onClick={() => {
                      setConflict(null);
                      setStep("preview");
                    }}
                  >
                    Keep existing enrolment for {conflict.conflictingGuestName}
                  </Button>
                  <Button
                    type="button"
                    className="bg-amber-600/90 text-white hover:bg-amber-600"
                    onClick={() => void resolveTransfer()}
                  >
                    Transfer to {props.guestName ?? "current guest"}
                  </Button>
                </div>
              ) : (
                <p className="rounded-md border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
                  Please ask your supervisor to resolve this conflict. Reference:{" "}
                  <span className="font-mono text-xs">{conflict.conflictingEnrollmentId}</span>
                </p>
              )}
            </div>
          ) : null}

          {step === "done" ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <CheckCircle2 className="h-14 w-14 text-fg-success-text" />
              <p className="text-lg font-medium text-fg-ink">Enrolment complete</p>
              <p className="text-sm text-fg-mist">{props.guestName ?? "Guest"}</p>
              <Button type="button" className="bg-fg-gold text-fg-black" onClick={props.onClose}>
                Close
              </Button>
            </div>
          ) : null}

          {step === "error" ? (
            <div className="space-y-4 py-6">
              <p className="text-sm text-fg-danger-text">{errorMsg}</p>
              <Button type="button" className="bg-fg-gold text-fg-black" onClick={() => setStep("consent")}>
                Try Again
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
