import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewDeviceLoading() {
  return (
    <Card className="mx-auto max-w-lg border-fg-line bg-fg-surface">
      <CardHeader>
        <Skeleton className="h-7 w-48 bg-fg-elevated" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-full bg-fg-elevated" />
        <Skeleton className="h-10 w-32 bg-fg-elevated" />
      </CardContent>
    </Card>
  );
}
