"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { canManageStaff } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function StaffRowActions({
  userId,
  isActive,
  selfId,
}: {
  userId: string;
  isActive: boolean;
  selfId: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const allowed = canManageStaff(session);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!allowed || userId === selfId) {
    return <span className="text-xs text-fg-mist">—</span>;
  }

  async function confirm() {
    setLoading(true);
    const res = await fetch(`/api/admin/staff/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok || json.error) {
      toast.error(json.error ?? "Update failed");
      return;
    }
    toast.success(isActive ? "User deactivated" : "User activated");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-fg-line"
        onClick={() => setOpen(true)}
      >
        {isActive ? "Deactivate" : "Activate"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-fg-line bg-fg-surface text-fg-ink">
          <DialogHeader>
            <DialogTitle>{isActive ? "Deactivate user?" : "Activate user?"}</DialogTitle>
            <DialogDescription className="text-fg-mist">
              {isActive
                ? "They will immediately lose access to the console until reactivated."
                : "They will regain access according to their role."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="border-fg-line" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={isActive ? "destructive" : "default"}
              className={isActive ? "bg-fg-danger text-fg-danger-text" : "bg-fg-gold text-fg-black"}
              disabled={loading}
              onClick={() => void confirm()}
            >
              {loading ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
