import { Badge } from "@/components/ui/badge";
import type { StaffRole } from "@prisma/client";

export function StaffRoleBadge({ role }: { role: StaffRole }) {
  return (
    <Badge variant="outline" className="border-fg-line bg-fg-elevated text-fg-ink">
      {role.replaceAll("_", " ")}
    </Badge>
  );
}
