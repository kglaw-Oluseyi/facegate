import { GuestWorkspace } from "@/components/staff/guest-workspace";

export default function StaffGuestsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg-ink">Guests</h1>
        <p className="text-sm text-fg-mist">Search, check in, and enrol faces for this event.</p>
      </div>
      <GuestWorkspace />
    </div>
  );
}
