"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function EventDeletionActions({
  eventId,
  disabled,
}: {
  eventId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function runDeletion() {
    setLoading(true);
    const res = await fetch(`/api/admin/events/${eventId}/delete-biometrics`, {
      method: "POST",
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok || json.error) {
      toast.error(json.error ?? "Deletion failed");
      return;
    }
    toast.success(
      `Deletion completed · ${json.data?.enrollmentCount ?? 0} enrollment(s)`
    );
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="destructive"
      className="border-fg-danger-text bg-fg-danger text-fg-danger-text"
      disabled={disabled || loading}
      onClick={() => void runDeletion()}
    >
      {loading ? "Running…" : "Run biometric deletion"}
    </Button>
  );
}
