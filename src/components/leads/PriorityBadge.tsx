import type { FollowUpPriority } from "@/types/followUp";
import { formatLabel } from "@/lib/utils/format";

const PRIORITY_STYLES: Record<FollowUpPriority, string> = {
  high: "bg-danger/10 text-danger",
  medium: "bg-warning/10 text-warning",
  low: "bg-line text-subtle",
};

export function PriorityBadge({ priority }: { priority: FollowUpPriority }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority]}`}>
      {formatLabel(priority)}
    </span>
  );
}
