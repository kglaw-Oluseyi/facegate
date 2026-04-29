export interface ManualSection {
  id: string;
  title: string;
  category: "setup" | "operations" | "exceptions" | "privacy" | "technical";
  content: string;
  tags: string[];
}

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "event-setup",
    title: "Setting up an event",
    category: "setup",
    tags: ["event", "setup", "status", "retention", "mode"],
    content: `
## Overview
FaceGate OS events define the operating window (dates/timezone), the guest list source, and the retention lifecycle.

## Creating an event
In the admin console, create a new event and provide:
- **Name**: Human-friendly identifier for staff.
- **Slug**: Stable URL-safe identifier (lowercase, hyphens). Used in integration workflows.
- **Venue**: Venue name + timezone. Timezone drives “today”, reporting windows, and retention schedules.
- **Dates**: Start/end date-time. These boundaries are used for analytics windows and close-out automation.
- **Mode**: Standalone or Integrated (details below).

## STANDALONE vs INTEGRATED
- **STANDALONE**: FaceGate OS is the source of truth for walk-up guests and enrolment workflows. Staff can create walk-ups and operate without an external system.
- **INTEGRATED**: Use when a ticketing / CRM / admissions system is the source of truth. Guest lists arrive via the Integration API and admission state changes are mirrored operationally.

## Retention policy
Retention determines how long biometric references remain available after the event ends. The default operational standard is **72 hours** after event end.
- Use longer retention only when explicitly approved.
- Shorter retention reduces exposure but may limit post-event dispute resolution.

## Event statuses and operational meaning
Events progress through:
- **DRAFT**: Configuration phase. Devices should not operate.
- **READY**: Pre-open phase. Devices may be provisioned and diagnostics run.
- **LIVE**: Gates are operating and the kiosk loop is active.
- **CLOSED**: Gates should stop admitting guests. Post-event workflows begin.
- **ARCHIVED**: Long-term record state. Used after deletion and final reconciliation.

## Moving through statuses
Typical sequence:
1. **DRAFT → READY** once gates/devices and staff plan are confirmed.
2. **READY → LIVE** shortly before doors open (after diagnostics pass).
3. **LIVE → CLOSED** immediately after final admissions.
4. **CLOSED → ARCHIVED** after biometric deletion and reporting export (as needed).
`,
  },
  {
    id: "gate-setup",
    title: "Configuring gates and devices",
    category: "setup",
    tags: ["gates", "devices", "provision", "diagnostic", "checklist"],
    content: `
## Creating gates
Create a gate for each physical ingress point. Gates represent the operational policy and device pool at that location.

## Gate types
- **CHECKIN**: Used for check-in flows where admission state changes may be applied.
- **REENTRY**: Used for re-entry / validation flows during the event.

## Provisioning a device
Provision a device from the event console:
1. Choose the target gate.
2. A **credential is shown once**. Copy and store it immediately.
3. Paste the credential into the kiosk device setup screen.

If the credential is lost, **reprovision** — do not attempt recovery.

## Pre-open diagnostic checklist
Before setting an event to LIVE, verify:
- **Camera**: front camera detected, stable image, no glare.
- **Connectivity**: device can reach FaceGate OS APIs consistently.
- **Provider status**: biometric provider reports healthy.
- **Heartbeat**: device heartbeats are recent and stable.
- **Gate active**: gate is not paused.

## What each check means
- Camera issues cause degraded capture quality and false denies.
- Connectivity issues cause “unavailable” states and delayed decisions.
- Provider issues surface as sustained ERROR decisions.
- Heartbeat issues indicate device sleep, OS power policies, or network drop.

## If a check fails
- **Camera**: clean lens, adjust angle/lighting, disable aggressive exposure changes.
- **Connectivity**: switch Wi‑Fi network, verify captive portals are disabled, test DNS.
- **Provider**: pause the gate, run manual admissions, contact an administrator.
- **Heartbeat**: disable low power mode, keep device plugged in, restart kiosk session.
`,
  },
  {
    id: "guest-checkin",
    title: "Checking in guests",
    category: "operations",
    tags: ["guests", "check-in", "search", "csv", "walk-up"],
    content: `
## Finding a guest
Use the staff workspace search to locate a guest by:
- **Name** (partial match)
- **External ID** (if integrated)

## Admission state badges
Admission state communicates whether the guest is allowed at a gate:
- **NOT_CHECKED_IN**: guest is known but not admitted yet
- **CHECKED_IN**: guest is admitted
- **REVOKED**: guest is explicitly denied (supervisor action)

## Checking in a guest
1. Open the guest record.
2. Apply **Check in**.
3. Proceed to enrolment if the event uses biometrics for re-entry.

## Creating a walk-up guest (Standalone)
In standalone mode, staff may create a guest on arrival:
1. Create the guest record (name recommended).
2. Check them in.
3. Enrol biometrics at the staff desk.

## Importing a guest list via CSV
Use the staff import flow to upload guests in bulk.
- Validate headers and sample rows before importing the full list.
- For integrated events, prefer the Integration API to preserve external IDs and upstream reconciliation.
`,
  },
  {
    id: "biometric-enrolment",
    title: "Biometric enrolment",
    category: "operations",
    tags: ["enrolment", "consent", "re-enrol", "conflict"],
    content: `
## When to enrol
Enrol **after check-in**. This ensures the guest is admitted before biometric access is issued.

## Consent notice
FaceGate OS requires consent acknowledgment before biometric processing.
Consent exists to:
- confirm the guest understands biometric processing is used for event admission
- establish a clear operational and privacy record

## Per-guest vs per-event consent
- **Per-guest**: consent is acknowledged per guest during enrolment.
- **Per-event**: consent is confirmed once for the whole event (used when event-level consent has been collected by the organiser).

## Camera guidance (capture quality)
- Face forward, neutral expression
- Avoid strong backlight or glare
- Keep the camera steady and at eye level
- Ensure the guest fills the frame without cropping

## Re-enrolment
Re-enrol when:
- capture quality was poor (motion blur, lighting, occlusion)
- guest appearance materially changed (glasses, mask, headwear)
- repeated NO_BIOMETRIC_MATCH denies occur

## Enrolment conflict
An enrolment conflict indicates the provider believes two enrolments refer to the same biometric identity.
Supervisor action is required to review both records and choose whether to:
- transfer the biometric reference to the correct guest, or
- cancel the new enrolment attempt
`,
  },
  {
    id: "gate-operations",
    title: "Running gates during an event",
    category: "operations",
    tags: ["kiosk", "allow", "deny", "error", "gate health", "pause"],
    content: `
## How the kiosk scan loop works
While a gate is active, the kiosk:
1. captures a frame periodically
2. submits an attempt to the decision API
3. renders ALLOW / DENY / ERROR immediately
4. resets to idle after a configured timeout

## What guests should do
Guests should look at the camera. No physical action is required.

## Decision meanings
- **ALLOW**: guest is admitted and can proceed.
- **DENY**: admission state or match failed. Staff should resolve at the desk.
- **ERROR**: provider or system error. Treat as operational degradation.

## Pausing and resuming gates remotely
From the event command centre:
- Pause a single gate (or all gates) to stop admissions.
- Resume when diagnostics and connectivity are stable.

## When a gate goes amber or red
- **Amber (degraded)**: heartbeat is late; expect intermittent delays.
- **Red (offline)**: device is not reachable; move to manual process.

## Unavailable state
Unavailable typically indicates repeated network/API failures.
Resolution:
- verify network and DNS
- restart kiosk session
- if sustained, switch to manual admissions and notify an administrator
`,
  },
  {
    id: "exception-handling",
    title: "Handling exceptions",
    category: "exceptions",
    tags: ["deny", "no match", "auth failure", "provider", "manual"],
    content: `
## Guest denied — GUEST_NOT_CHECKED_IN
Check the guest in at the staff desk, then re-attempt.

## Guest denied — GUEST_REVOKED
Supervisor required. Do not admit until the revoke is reviewed.

## Guest denied — NO_BIOMETRIC_MATCH
Re-enrol the guest at the staff desk. Verify lighting and capture guidance.

## Device auth failure
Confirm the credential is correct. If unknown or compromised:
- reprovision the device
- re-pair the kiosk

## Provider error sustained
Pause the gate and switch to manual admissions.
Escalate to an administrator with timestamps and affected gate/device.

## Enrolment conflict
Supervisor reviews both guest records and decides whether to transfer or cancel.
`,
  },
  {
    id: "supervisor-actions",
    title: "Supervisor actions",
    category: "exceptions",
    tags: ["supervisor", "revoke", "restore", "audit", "export"],
    content: `
## Revoking admission
Use revoke when a guest must not be admitted (safety, policy, or operational instruction).
- Requires a reason.
- Changes are logged in the audit trail.

## Restoring revoked admission
Restore only after the reason is resolved and the guest is cleared.

## Resolving enrolment conflicts
Review both records:
- confirm identity with staff verification
- transfer biometric reference to the correct guest if necessary
- otherwise cancel the duplicate enrolment attempt

## Overriding check-in policy
If policy requires gate-side admission:
- apply check-in at the desk with verification
- ensure enrolment occurs only after admission is correct

## Viewing the live attempt log
Use the Attempts view during LIVE operations to identify:
- repeated denies
- device-specific errors
- latency spikes

## Exporting the audit log
Administrators can export CSV for compliance and post-event reporting.
`,
  },
  {
    id: "post-event",
    title: "Closing an event",
    category: "operations",
    tags: ["close", "deletion", "certificate", "archive"],
    content: `
## Setting event to CLOSED
Close the event as soon as admissions are complete. This indicates gates should stop admitting guests.

## What happens to active kiosks on close
Kiosks will stop normal operation and transition to a non-operational state on their next heartbeat.

## Triggering biometric deletion
From the event’s Biometric deletion workspace:
1. Confirm the event is CLOSED or ARCHIVED.
2. Run deletion (only one run can execute at a time).

## Deletion process (step-by-step)
Deletion performs:
- a deletion run record is created and marked RUNNING
- provider biometric references are deleted (provider-side)
- enrolment records are soft-deleted in FaceGate OS
- an audit trail is written (started/completed/failed)
- tenant administrators are notified

## Downloading the deletion certificate
After completion, download the PDF certificate to attach to event compliance records.

## Archiving the event
Archive after deletion and reporting is complete.
`,
  },
  {
    id: "privacy-data",
    title: "Privacy and data handling",
    category: "privacy",
    tags: ["privacy", "retention", "deletion", "certificate", "sweeper"],
    content: `
## What FaceGate OS stores
- Opaque biometric references (provider handles biometric templates)
- Admission state and enrolment status
- Attempts and audit events for operational integrity

FaceGate OS does **not** store:
- face images
- facial geometry templates

## What the biometric provider receives
The provider receives biometric material and returns opaque references.
Guest PII is not sent unless explicitly configured by the provider integration (not recommended).

## Retention policy
Default: **72 hours after event end**.
This window supports post-event dispute handling while minimizing exposure.

## How deletion works
Deletion removes provider references and marks enrolments deleted in FaceGate OS.
The certificate provides evidence of the deletion workflow run.

## Guest right to deletion
When a guest requests deletion:
- identify the guest record and associated enrolments
- perform deletion via approved workflows
- record the request and completion in the audit log

## Automated retention sweeper
The retention sweeper periodically closes out and deletes biometrics for events past their retention window.
`,
  },
  {
    id: "integration-api",
    title: "Integration API",
    category: "technical",
    tags: ["integration", "api", "sync", "status", "retries"],
    content: `
## When to use the Integration API
Use for **INTEGRATED** events when your upstream system owns the guest list and admission state.

## Authentication
Use bearer token authentication:
- \`Authorization: Bearer INTEGRATION_API_KEY\`

## Guest sync endpoint
- **Method**: POST
- **Path**: \`/api/v1/events/[slug]/guests/sync\`
- **Purpose**: Upsert guests from an upstream manifest.

Payload expectations:
- stable external IDs when available
- names for staff search and reconciliation
- admission state updates as upstream changes

## Incremental sync during live events
Run sync repeatedly:
- before doors open (full manifest)
- during LIVE operations (incremental changes)
- after the event for reconciliation

## Event status endpoint
- **Method**: GET
- **Path**: \`/api/v1/events/[slug]/status\`
- **Purpose**: Retrieve a snapshot for dashboards and monitoring.

## API key management
- treat the API key as a secret
- rotate on schedule or on suspicion of compromise
- scope access by deployment environment

## Error handling and retries
- retry transient 5xx with exponential backoff
- do not retry 4xx without correcting payload/auth
- log request IDs and timestamps for traceability
`,
  },
];

