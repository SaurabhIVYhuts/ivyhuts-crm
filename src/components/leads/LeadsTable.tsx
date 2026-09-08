"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, SlidersHorizontal, Users } from "lucide-react";
import type { WorkQueueLead } from "@/types/workQueue";
import type { StaffUser } from "@/types/staff";
import { StatusBadge } from "@/components/leads/StatusBadge";
import { TYPE_ICONS } from "@/components/follow-ups/NextActionCard";
import { Avatar } from "@/components/ui/Avatar";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
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

// CRM plan item 2 — a budget string from the lead's Discovery snapshot,
// honest about missing data (no fabricated "0" or "—" range halves).
function formatBudget(d: WorkQueueLead["discovery"]): string {
  if (!d) return "—";
  const { budgetMin, budgetMax, currency } = d;
  if (budgetMin == null && budgetMax == null) return "—";
  const cur = currency ? `${currency} ` : "";
  if (budgetMin != null && budgetMax != null) return `${cur}${budgetMin.toLocaleString()}–${budgetMax.toLocaleString()}`;
  const one = (budgetMin ?? budgetMax) as number;
  return `${budgetMin != null ? "from " : "up to "}${cur}${one.toLocaleString()}`;
}

// Every column the Lead Inbox can show. `defaultOn: false` columns are
// hidden until the viewer turns them on from the Columns menu; the choice
// is a per-browser convenience (localStorage), not a saved setting.
type LeadColumnKey =
  | "lead"
  | "phone"
  | "source"
  | "status"
  | "summary"
  | "moveIn"
  | "city"
  | "university"
  | "budget"
  | "assignedTo"
  | "nextAction"
  | "lastContact"
  | "created";

const COLUMN_ORDER: Array<{ key: LeadColumnKey; label: string; defaultOn: boolean }> = [
  { key: "lead", label: "Lead", defaultOn: true },
  { key: "phone", label: "Phone", defaultOn: true },
  { key: "status", label: "Status", defaultOn: true },
  { key: "summary", label: "Summary", defaultOn: true },
  { key: "nextAction", label: "Next Action", defaultOn: true },
  { key: "assignedTo", label: "Assigned Agent", defaultOn: true },
  { key: "moveIn", label: "Move-in", defaultOn: false },
  { key: "city", label: "City", defaultOn: false },
  { key: "university", label: "University", defaultOn: false },
  { key: "budget", label: "Budget", defaultOn: false },
  { key: "source", label: "Source", defaultOn: false },
  { key: "lastContact", label: "Last Contact", defaultOn: false },
  { key: "created", label: "Created", defaultOn: false },
];

const STORAGE_KEY = "ivyhuts-crm:leads-columns";

function readStoredColumns(): Set<LeadColumnKey> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return null;
    const valid = new Set(COLUMN_ORDER.map((c) => c.key as string));
    return new Set(parsed.filter((k) => valid.has(k)) as LeadColumnKey[]);
  } catch {
    return null;
  }
}

function defaultVisible(): Set<LeadColumnKey> {
  return new Set(COLUMN_ORDER.filter((c) => c.defaultOn).map((c) => c.key));
}

function ColumnsMenu({
  visible,
  onToggle,
}: {
  visible: Set<LeadColumnKey>;
  onToggle: (key: LeadColumnKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative self-end">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-subtle hover:bg-surface-2 hover:text-ink"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Columns
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-48 rounded-lg border border-line bg-surface p-1 shadow-xl">
          {COLUMN_ORDER.map((col) => (
            <label
              key={col.key}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-surface-2 ${
                col.key === "lead" ? "opacity-50" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={visible.has(col.key)}
                disabled={col.key === "lead"}
                onChange={() => onToggle(col.key)}
                className="accent-accent"
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
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
  const [visible, setVisible] = useState<Set<LeadColumnKey>>(defaultVisible);

  useEffect(() => {
    const stored = readStoredColumns();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setVisible(stored);
  }, []);

  function toggleColumn(key: LeadColumnKey) {
    if (key === "lead") return; // the identity column can't be hidden
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Non-fatal — the choice just won't persist.
      }
      return next;
    });
  }

  const allColumns: Record<LeadColumnKey, DataTableColumn<WorkQueueLead>> = {
    lead: {
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
    phone: { key: "phone", header: "Phone", render: (lead) => <span className="text-subtle">{lead.contact.phone || "—"}</span> },
    source: { key: "source", header: "Source", render: (lead) => <span className="text-subtle">{lead.source ? formatLabel(lead.source) : "—"}</span> },
    status: { key: "status", header: "Status", render: (lead) => <StatusBadge status={lead.status} /> },
    summary: {
      key: "summary",
      header: "Summary",
      render: (lead) => <span className="text-subtle">{lead.summary || "—"}</span>,
      className: "max-w-[16rem] truncate",
    },
    moveIn: { key: "moveIn", header: "Move-in", render: (lead) => <span className="text-subtle">{lead.discovery?.moveInDate ? formatDate(lead.discovery.moveInDate) : "—"}</span> },
    city: { key: "city", header: "City", render: (lead) => <span className="text-subtle">{lead.property.city || "—"}</span> },
    university: { key: "university", header: "University", render: (lead) => <span className="text-subtle">{lead.discovery?.university || "—"}</span> },
    budget: { key: "budget", header: "Budget", render: (lead) => <span className="text-subtle">{formatBudget(lead.discovery)}</span> },
    assignedTo: {
      key: "assignedTo",
      header: "Assigned Agent",
      render: (lead) => (
        <span className="text-subtle">
          {lead.assignedTo ? staffById[lead.assignedTo]?.name || `Agent #${lead.assignedTo.slice(-6)}` : "Unassigned"}
        </span>
      ),
    },
    nextAction: { key: "nextAction", header: "Next Action", render: (lead) => <NextActionCell lead={lead} /> },
    lastContact: { key: "lastContact", header: "Last Contact", render: (lead) => <span className="text-subtle">{formatDate(lead.lastContactAt)}</span> },
    created: { key: "created", header: "Created", render: (lead) => <span className="text-subtle">{formatDate(lead.createdAt)}</span> },
  };

  const columns = COLUMN_ORDER.filter((c) => visible.has(c.key)).map((c) => allColumns[c.key]);

  return (
    <div className="flex flex-col gap-2">
      <ColumnsMenu visible={visible} onToggle={toggleColumn} />
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
    </div>
  );
}
