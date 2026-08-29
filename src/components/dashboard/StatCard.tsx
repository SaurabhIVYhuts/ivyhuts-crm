import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { KpiSkeleton } from "@/components/ui/Skeleton";

// A compact KPI tile. No fabricated trend/percentage is shown — this
// backend's work-queue aggregate is a point-in-time snapshot, not a time
// series, so there is no real "vs last month" figure to compute. `hint`
// carries whatever real, available supporting context there is instead
// (e.g. "of 248 total") rather than an invented delta.
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  isLoading,
  href,
  tone = "default",
}: {
  label: string;
  value: number | null;
  hint?: string;
  icon?: LucideIcon;
  isLoading: boolean;
  href?: string;
  tone?: "default" | "warning" | "success";
}) {
  if (isLoading) return <KpiSkeleton />;

  const valueTone = tone === "warning" && value ? "text-warning" : tone === "success" && value ? "text-success" : "text-ink";

  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-faint">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-faint" />}
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${valueTone}`}>{value === null ? "—" : value.toLocaleString()}</div>
      {hint && <div className="mt-1 truncate text-xs text-subtle">{hint}</div>}
    </>
  );

  const className = `rounded-xl border border-line bg-surface p-4 ${href ? "block transition-colors hover:border-accent/40 hover:bg-surface-hover" : ""}`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}
