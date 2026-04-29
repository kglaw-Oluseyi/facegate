import { Badge } from "@/components/ui/badge";
import type { Decision } from "@prisma/client";

const styles: Record<Decision, string> = {
  ALLOW: "border-fg-success-text/40 bg-fg-success text-fg-success-text",
  DENY: "border-fg-danger-text/40 bg-fg-danger text-fg-danger-text",
  ERROR: "border-fg-warning-text/40 bg-fg-warning text-fg-warning-text",
};

export function DecisionBadge({ decision }: { decision: Decision }) {
  return (
    <Badge variant="outline" className={styles[decision]}>
      {decision}
    </Badge>
  );
}
