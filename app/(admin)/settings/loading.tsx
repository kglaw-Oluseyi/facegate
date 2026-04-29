import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Skeleton className="h-8 w-40 bg-fg-elevated" />
      <Skeleton className="h-40 w-full bg-fg-elevated" />
    </div>
  );
}
