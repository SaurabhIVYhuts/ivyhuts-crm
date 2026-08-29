"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import type { WorkQueueLead } from "@/types/workQueue";
import type { StaffUser } from "@/types/staff";
import { StatusBadge } from "@/components/leads/StatusBadge";
import { TYPE_ICONS } from "@/components/follow-ups/NextActionCard";
import { Avatar } from "@/components/ui/Avatar";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Users } from "lucide-react";
import { formatDate, formatTime, formatLabel, relativeDay } from "@/lib/utils/format";

// Reuses NextActionCard's own overdue rule (dueAt < now, not day-boundary)
// since this is the same "is this specific follow-up currently overdue"
// question that component already answers for the Lead Detail page — a
// lead's `bucket` field (day-boundary, from the backend's work-queue
// aggregation) drives which PILE this row sorts into, but the per-row
// red/not-red styling here mirrors the finer-grained, already-shipped
// NextActionCard convention so the two views never visually disagree about
// a follow-up due earlier today.
// Exported for reuse by the Dashboard's Today's Follow-ups / Overdue cards
// (CRM Milestone 16) — same overdue-icon-type-time rendering, not a second
// copy.
export function NextActionCell({ lead }: { lead: WorkQueueLead }) {
  if (!lead.nextFollowUp) {
    return <span className="inline-flex items-center gap-1 text-xs text-warning">No next action</span>;
  }
  const { type, dueAt } = lead.nextFollowUp;
  const Icon = TYPE_ICONS[type] || MoreHorizontal;
  const overdue = new Date(dueAt).getTime() < new Date().getTime();
  return (
    <div className={`flex items-center gap-1.5 text-xs ${overdue ? "text-danger" : "text-subtle"}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <div>
        {overdue && <div className="text-[10px] font-semibold uppercase tracking-wide">Overdue</div>}
        <div>
          {formatLabel(type)} · {relativeDay(dueAt)} · {formatTime(dueAt)}
        </div>
      </div>
    </div>
  );
}

export function LeadsTable({
  leads,
  isLoading,
  hasActiveFilters,
  staffById,
}: {
  leads: WorkQueueLead[];
  isLoading: boolean;
  hasActiveFilters: boolean;
  staffById: Record<string, StaffUser>;
}) {
  const router = useRouter();

  const columns: DataTableColumn<WorkQueueLead>[] = [
    {
      key: "lead",
      header: "Lead",
      render: (lead) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={lead.contact.name} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{lead.contact.name || "Unnamed lead"}</div>
            {lead.contact.email && <div className="truncate text-xs text-faint">{lead.contact.email}</div>}
          </div>
        </div>
      ),
    },
    { key: "phone", header: "Phone", render: (lead) => <span className="text-subtle">{lead.contact.phone || "—"}</span> },
    { key: "source", header: "Source", render: (lead) => <span className="text-subtle">{lead.source ? formatLabel(lead.source) : "—"}</span> },
    { key: "status", header: "Status", render: (lead) => <StatusBadge status={lead.status} /> },
    {
      key: "assignedTo",
      header: "Assigned Agent",
      render: (lead) => (
        <span className="text-subtle">
          {lead.assignedTo ? staffById[lead.assignedTo]?.name || `Agent #${lead.assignedTo.slice(-6)}` : "Unassigned"}
        </span>
      ),
    },
    { key: "nextAction", header: "Next Action", render: (lead) => <NextActionCell lead={lead} /> },
    { key: "lastContact", header: "Last Contact", render: (lead) => <span className="text-subtle">{formatDate(lead.lastContactAt)}</span> },
    { key: "created", header: "Created", render: (lead) => <span className="text-subtle">{formatDate(lead.createdAt)}</span> },
  ];

  return (
    <DataTable
      columns={columns}
      rows={leads}
      rowKey={(lead) => lead.id}
      isLoading={isLoading}
      onRowClick={(lead) => router.push(`/dashboard/leads/${lead.id}`)}
      emptyIcon={Users}
      emptyTitle={hasActiveFilters ? "No leads match this filter." : "No leads have been created yet."}
      emptyDescription={hasActiveFilters ? "Try a different quick filter or clear your filters." : "New leads will appear here as they arrive."}
      skeletonRows={8}
    />
  );
}
