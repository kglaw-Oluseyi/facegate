import { Skeleton } from "@/components/ui/skeleton";

export default function GuestsLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Skeleton className="h-10 w-48 bg-fg-elevated" />
      <Skeleton className="h-12 w-full bg-fg-elevated" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full bg-fg-elevated" />
        ))}
      </div>
    </div>
  );
}
