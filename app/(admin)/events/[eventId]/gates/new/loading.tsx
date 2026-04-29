import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewGateLoading() {
  return (
    <Card className="mx-auto max-w-lg border-fg-line bg-fg-surface">
      <CardHeader>
        <Skeleton className="h-7 w-40 bg-fg-elevated" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full bg-fg-elevated" />
        ))}
      </CardContent>
    </Card>
  );
}
