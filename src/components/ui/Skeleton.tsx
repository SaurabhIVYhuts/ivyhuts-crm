export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-2 ${className}`} />;
}

// Matches a StatCard's dimensions so a loading KPI row never collapses/
// reflows once real numbers arrive.
export function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-3 h-3 w-24" />
    </div>
  );
}

// Matches a compact list row (avatar + two lines of text) used across
// Today's Work / Priority Queue / Follow-ups / Meetings.
export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="mt-1.5 h-3 w-28" />
      </div>
    </div>
  );
}
