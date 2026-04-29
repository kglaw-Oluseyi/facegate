import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function EventsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40 bg-fg-elevated" />
        <Skeleton className="h-9 w-32 bg-fg-elevated" />
      </div>
      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <Skeleton className="h-5 w-48 bg-fg-elevated" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-fg-elevated" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
