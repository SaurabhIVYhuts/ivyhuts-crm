import type { LeadStatus } from "@/types/lead";
import { formatLabel } from "@/lib/utils/format";

// Colors are purely presentational grouping (new/in-progress/won/lost) —
// the underlying value is always the real backend LeadStatus, never
// remapped or invented. Mapped onto the CRM's one accent/success/warning
// palette rather than a rainbow of unrelated hues.
const STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-accent/10 text-accent-strong",
  contacted: "bg-warning/10 text-warning",
  qualified: "bg-violet-500/10 text-violet-300",
  nurturing: "bg-cyan-500/10 text-cyan-300",
  converted: "bg-success/10 text-success",
  lost: "bg-line text-faint",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {formatLabel(status)}
    </span>
  );
}
