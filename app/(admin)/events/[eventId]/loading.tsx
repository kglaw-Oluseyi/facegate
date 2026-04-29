import { Skeleton } from "@/components/ui/skeleton";

export default function EventDetailLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-40 w-full bg-fg-elevated" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 bg-fg-elevated" />
        <Skeleton className="h-48 bg-fg-elevated" />
      </div>
      <Skeleton className="h-32 w-full bg-fg-elevated" />
      <Skeleton className="h-64 w-full bg-fg-elevated" />
    </div>
  );
}
