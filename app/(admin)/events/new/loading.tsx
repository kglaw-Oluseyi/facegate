import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewEventLoading() {
  return (
    <Card className="mx-auto max-w-2xl border-fg-line bg-fg-surface">
      <CardHeader>
        <Skeleton className="h-7 w-48 bg-fg-elevated" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full bg-fg-elevated" />
        ))}
      </CardContent>
    </Card>
  );
}
