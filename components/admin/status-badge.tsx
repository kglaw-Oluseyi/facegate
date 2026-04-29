import { Badge } from "@/components/ui/badge";
import type { EventStatus } from "@prisma/client";

const styles: Record<EventStatus, string> = {
  LIVE: "border-fg-gold/40 bg-fg-gold/15 text-fg-gold",
  DRAFT: "border-fg-line bg-fg-surface text-fg-mist",
  READY: "border-fg-ready-text/30 bg-fg-ready text-fg-ready-text",
  CLOSED: "border-fg-danger-text/30 bg-fg-danger text-fg-danger-text",
  ARCHIVED: "border-fg-archive-text/40 bg-fg-archive text-fg-archive-text",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <Badge variant="outline" className={styles[status]}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
