const LABELS: Record<string, string> = {
  GUEST_ADMISSION_CHANGED: "Admission state changed",
  REENTRY_ATTEMPT: "Re-entry attempt",
  DEVICE_AUTH_FAILURE: "Device authentication failed",
  KIOSK_CONFIG_UPDATED: "Kiosk configuration updated",
  KIOSK_PER_EVENT_CONSENT_CONFIRMED: "Per-event consent approved",
  GUEST_BIOMETRIC_ENROLLED: "Biometric enrolment",
  BIOMETRIC_PURGE_INITIATED: "Biometric purge initiated",
  DELETION_RUN_STARTED: "Deletion run started",
  DELETION_RUN_COMPLETED: "Deletion run completed",
  DELETION_RUN_FAILED: "Deletion run failed",
  EVENT_STATUS_CHANGED: "Event status changed",
  DEVICE_PROVISIONED: "Device provisioned",
  DEVICE_REVOKED: "Device revoked",
  GATE_PAUSED: "Gate paused",
  GATE_RESUMED: "Gate resumed",
};

export function auditActionLabel(action: string): string {
  return LABELS[action] ?? action.replace(/_/g, " ").toLowerCase();
}

export type AuditCategory = "ADMISSION" | "ENROLMENT" | "DEVICE" | "CONFIGURATION" | "DELETION";

export const AUDIT_GROUPS: Record<AuditCategory, readonly string[]> = {
  ADMISSION: ["GUEST_ADMISSION_CHANGED", "REENTRY_ATTEMPT", "GUEST_SYNC_MANIFEST"],
  ENROLMENT: ["GUEST_BIOMETRIC_ENROLLED"],
  DEVICE: [
    "DEVICE_AUTH_FAILURE",
    "GATE_PAUSED",
    "GATE_RESUMED",
    "DEVICE_PROVISIONED",
    "DEVICE_REVOKED",
  ],
  CONFIGURATION: [
    "KIOSK_CONFIG_UPDATED",
    "KIOSK_PER_EVENT_CONSENT_CONFIRMED",
    "EVENT_STATUS_CHANGED",
  ],
  DELETION: [
    "DELETION_RUN_STARTED",
    "DELETION_RUN_COMPLETED",
    "DELETION_RUN_FAILED",
    "BIOMETRIC_PURGE_INITIATED",
  ],
};

export function auditCategory(action: string): AuditCategory {
  for (const [cat, actions] of Object.entries(AUDIT_GROUPS) as [
    AuditCategory,
    readonly string[],
  ][]) {
    if (actions.includes(action)) return cat;
  }
  if (
    action.includes("ADMISSION") ||
    action.includes("CHECK") ||
    action === "GUEST_SYNC_MANIFEST"
  ) {
    return "ADMISSION";
  }
  if (action.includes("ENROLL") || action.includes("BIOMETRIC_ENROLL")) {
    return "ENROLMENT";
  }
  if (
    action.includes("DEVICE") ||
    action.includes("GATE_") ||
    action.includes("AUTH_FAILURE")
  ) {
    return "DEVICE";
  }
  if (action.includes("DELETION") || action.includes("PURGE")) {
    return "DELETION";
  }
  return "CONFIGURATION";
}
