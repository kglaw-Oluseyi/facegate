import type { Prisma } from "@prisma/client";

export type ConsentMode = "per-guest" | "per-event";

export type KioskConfigResolved = {
  consentMode: ConsentMode;
  allowNameDisplay: boolean;
  allowCopy: string;
  denyCopy: string;
  errorCopy: string;
  unavailableCopy: string;
  resetAfterMs: number;
};

function envConsentDefault(): ConsentMode {
  const v = process.env.CONSENT_MODE_DEFAULT?.replace(/^"|"$/g, "").trim();
  return v === "per-event" ? "per-event" : "per-guest";
}

export function resolveKioskConfig(raw: Prisma.JsonValue | null | undefined): KioskConfigResolved {
  const defaults: KioskConfigResolved = {
    consentMode: envConsentDefault(),
    allowNameDisplay: true,
    allowCopy: "Welcome back. You're all set.",
    denyCopy: "Please see our staff.",
    errorCopy: "Please see our staff. This gate is temporarily unavailable.",
    unavailableCopy: "Please see our staff at the main entrance.",
    resetAfterMs: 4000,
  };

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaults;
  }

  const o = raw as Record<string, unknown>;

  let consentMode = defaults.consentMode;
  if (o.consentMode === "per-event") consentMode = "per-event";
  else if (o.consentMode === "per-guest") consentMode = "per-guest";

  const allowNameDisplay =
    typeof o.allowNameDisplay === "boolean" ? o.allowNameDisplay : defaults.allowNameDisplay;

  const allowCopy = typeof o.allowCopy === "string" && o.allowCopy.trim() ? o.allowCopy : defaults.allowCopy;
  const denyCopy = typeof o.denyCopy === "string" && o.denyCopy.trim() ? o.denyCopy : defaults.denyCopy;
  const errorCopy = typeof o.errorCopy === "string" && o.errorCopy.trim() ? o.errorCopy : defaults.errorCopy;
  const unavailableCopy =
    typeof o.unavailableCopy === "string" && o.unavailableCopy.trim()
      ? o.unavailableCopy
      : defaults.unavailableCopy;

  let resetAfterMs = defaults.resetAfterMs;
  if (typeof o.resetAfterMs === "number" && Number.isFinite(o.resetAfterMs) && o.resetAfterMs >= 1000) {
    resetAfterMs = Math.floor(o.resetAfterMs);
  }

  return {
    consentMode,
    allowNameDisplay,
    allowCopy,
    denyCopy,
    errorCopy,
    unavailableCopy,
    resetAfterMs,
  };
}
