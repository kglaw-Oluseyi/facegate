import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-fg-line bg-fg-surface">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24 bg-fg-elevated" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 bg-fg-elevated" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <Skeleton className="h-5 w-40 bg-fg-elevated" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-fg-elevated" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
