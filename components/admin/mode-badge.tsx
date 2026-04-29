import { Badge } from "@/components/ui/badge";
import type { EventMode } from "@prisma/client";

export function EventModeBadge({ mode }: { mode: EventMode }) {
  return (
    <Badge variant="outline" className="border-fg-line bg-fg-elevated text-fg-ink">
      {mode}
    </Badge>
  );
}
