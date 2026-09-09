"use client";

// The Lead Inbox grid — CRM plan item 2. Every business field the team
// works day to day lives here and is editable in place, spreadsheet-style:
// type in a cell, tab or click away, it saves. Nothing is batched behind a
// Save button, and nothing saves per keystroke — text commits on blur or
// Enter, selects commit on change.
//
// Edits fan out to the two endpoints that own each field:
//   PATCH /api/leads/:id            — contact, city, status, summary,
//                                     partner availability
//   PUT   /api/leads/:id/discovery  — university, move-in / departure,
//                                     budget (a partial upsert-merge)
// The row is updated optimistically and reverted if the request fails, so
// the grid never shows a value the backend didn't accept.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MoreHorizontal, SlidersHorizontal, Users } from "lucide-react";
import type { WorkQueueLead } from "@/types/workQueue";
import type { StaffUser } from "@/types/staff";
import {
  LEAD_STATUSES,
  PARTNER_AVAILABILITY_STATUSES,
  type LeadStatus,
  type PartnerAvailabilityStatus,
} from "@/types/lead";
import { updateLead } from "@/lib/api/leads";
import { saveDiscovery } from "@/lib/api/discovery";
import { TYPE_ICONS } from "@/components/follow-ups/NextActionCard";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { SelectCell, TextCell } from "@/components/leads/EditableCells";
import { formatTime, formatLabel, relativeDay } from "@/lib/utils/format";

// Reuses NextActionCard's own overdue rule (dueAt < now, not day-boundary)
// since this is the same "is this specific follow-up currently overdue"
// question that component already answers for the Lead Detail page — a
// lead's `bucket` field (day-boundary, from the backend's work-queue
// aggregation) drives which PILE this row sorts into, but the per-row
// red/not-red styling here mirrors the finer-grained, already-shipped
// NextActionCard convention so the two views never visually disagree about
// a follow-up due earlier today.
// Exported for reuse by the Dashboard's Today agenda (CRM Milestone 16) —
// same overdue-icon-type-time rendering, not a second copy.
export function NextActionCell({ lead }: { lead: WorkQueueLead }) {
  if (!lead.nextFollowUp) {
    return <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-warning">No next action</span>;
  }
  const { type, dueAt } = lead.nextFollowUp;
  const Icon = TYPE_ICONS[type] || MoreHorizontal;
  const overdue = new Date(dueAt).getTime() < new Date().getTime();
  return (
    <div className={`flex items-center gap-1.5 whitespace-nowrap text-xs ${overdue ? "text-danger" : "text-subtle"}`}>
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

// A stored date may be a plain "YYYY-MM-DD" or a full ISO timestamp;
// <input type="date"> only accepts the former.
function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

type LeadColumnKey =
  | "open"
  | "name"
  | "phone"
  | "email"
  | "moveIn"
  | "departure"
  | "city"
  | "university"
  | "budget"
  | "amberAvailability"
  | "amberReply"
  | "uhomesAvailability"
  | "uhomesReply"
  | "status"
  | "nextAction"
  | "summary"
  | "assignedTo";

// Order here is the on-screen order. Everything the team asked for is on by
// default; only the two extras (assigned agent) start hidden.
const COLUMN_ORDER: Array<{ key: LeadColumnKey; label: string; defaultOn: boolean }> = [
  { key: "open", label: "Open", defaultOn: true },
  { key: "name", label: "Name", defaultOn: true },
  { key: "phone", label: "Number", defaultOn: true },
  { key: "email", label: "Email", defaultOn: true },
  { key: "moveIn", label: "Move-in", defaultOn: true },
  { key: "departure", label: "Departure", defaultOn: true },
  { key: "city", label: "City", defaultOn: true },
  { key: "university", label: "University", defaultOn: true },
  { key: "budget", label: "Budget", defaultOn: true },
  { key: "amberAvailability", label: "Amber Availability", defaultOn: true },
  { key: "amberReply", label: "Amber Reply", defaultOn: true },
  { key: "uhomesAvailability", label: "uHomes Availability", defaultOn: true },
  { key: "uhomesReply", label: "uHomes Reply", defaultOn: true },
  { key: "status", label: "Status", defaultOn: true },
  { key: "nextAction", label: "Next Step", defaultOn: true },
  { key: "summary", label: "Summary", defaultOn: true },
  { key: "assignedTo", label: "Assigned Agent", defaultOn: false },
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

function ColumnsMenu({ visible, onToggle }: { visible: Set<LeadColumnKey>; onToggle: (key: LeadColumnKey) => void }) {
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
        <div className="absolute right-0 z-20 mt-1.5 max-h-80 w-56 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-xl">
          {COLUMN_ORDER.map((col) => (
            <label
              key={col.key}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-surface-2 ${
                col.key === "name" ? "opacity-50" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={visible.has(col.key)}
                disabled={col.key === "name"}
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
  const [visible, setVisible] = useState<Set<LeadColumnKey>>(defaultVisible);
  // A local, editable copy so a saved cell repaints immediately instead of
  // waiting for the parent's next fetch.
  const [rows, setRows] = useState<WorkQueueLead[]>(leads);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(leads);
  }, [leads]);

  useEffect(() => {
    const stored = readStoredColumns();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setVisible(stored);
  }, []);

  function toggleColumn(key: LeadColumnKey) {
    if (key === "name") return; // the identity column can't be hidden
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

  // Applies `patch` to the row optimistically, runs `request`, and reverts
  // the row if the request rejects. The cell re-throws so it can show its
  // own error state.
  async function withOptimisticRow(
    leadId: string,
    patch: (lead: WorkQueueLead) => WorkQueueLead,
    request: () => Promise<unknown>
  ) {
    let previous: WorkQueueLead | undefined;
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== leadId) return row;
        previous = row;
        return patch(row);
      })
    );
    try {
      await request();
    } catch (err) {
      if (previous) {
        const restore = previous;
        setRows((prev) => prev.map((row) => (row.id === leadId ? restore : row)));
      }
      throw err;
    }
  }

  const allColumns: Record<LeadColumnKey, DataTableColumn<WorkQueueLead>> = {
    open: {
      key: "open",
      header: "",
      render: (lead) => (
        <Link
          href={`/dashboard/leads/${lead.id}`}
          title="Open lead"
          className="inline-flex rounded-md p-1 text-faint hover:bg-surface-2 hover:text-accent"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      ),
    },
    name: {
      key: "name",
      header: "Name",
      render: (lead) => (
        <TextCell
          value={lead.contact.name}
          placeholder="Unnamed lead"
          widthClass="min-w-40"
          onSave={(raw) =>
            withOptimisticRow(
              lead.id,
              (r) => ({ ...r, contact: { ...r.contact, name: raw || null } }),
              () => updateLead(lead.id, { contact: { name: raw || null } })
            )
          }
        />
      ),
    },
    phone: {
      key: "phone",
      header: "Number",
      render: (lead) => (
        <TextCell
          value={lead.contact.phone}
          type="tel"
          placeholder="—"
          widthClass="min-w-32"
          onSave={(raw) =>
            withOptimisticRow(
              lead.id,
              (r) => ({ ...r, contact: { ...r.contact, phone: raw || null } }),
              () => updateLead(lead.id, { contact: { phone: raw || null } })
            )
          }
        />
      ),
    },
    email: {
      key: "email",
      header: "Email",
      render: (lead) => (
        <TextCell
          value={lead.contact.email}
          type="email"
          placeholder="—"
          widthClass="min-w-48"
          onSave={(raw) =>
            withOptimisticRow(
              lead.id,
              (r) => ({ ...r, contact: { ...r.contact, email: raw || null } }),
              () => updateLead(lead.id, { contact: { email: raw || null } })
            )
          }
        />
      ),
    },
    moveIn: {
      key: "moveIn",
      header: "Move-in",
      render: (lead) => (
        <TextCell
          value={toDateInput(lead.discovery?.moveInDate)}
          type="date"
          widthClass="min-w-36"
          onSave={(raw) =>
            withOptimisticRow(
              lead.id,
              (r) => ({ ...r, discovery: { ...(r.discovery ?? blankDiscovery()), moveInDate: raw || null } }),
              () => saveDiscovery(lead.id, { accommodation: { moveInDate: raw || null } })
            )
          }
        />
      ),
    },
    departure: {
      key: "departure",
      header: "Departure",
      render: (lead) => (
        <TextCell
          value={toDateInput(lead.discovery?.moveOutDate)}
          type="date"
          widthClass="min-w-36"
          onSave={(raw) =>
            withOptimisticRow(
              lead.id,
              (r) => ({ ...r, discovery: { ...(r.discovery ?? blankDiscovery()), moveOutDate: raw || null } }),
              () => saveDiscovery(lead.id, { accommodation: { moveOutDate: raw || null } })
            )
          }
        />
      ),
    },
    city: {
      key: "city",
      header: "City",
      render: (lead) => (
        <TextCell
          value={lead.property.city}
          placeholder="—"
          widthClass="min-w-28"
          onSave={(raw) =>
            withOptimisticRow(
              lead.id,
              (r) => ({ ...r, property: { ...r.property, city: raw || null } }),
              () => updateLead(lead.id, { property: { city: raw || null } })
            )
          }
        />
      ),
    },
    university: {
      key: "university",
      header: "University",
      render: (lead) => (
        <TextCell
          value={lead.discovery?.university ?? null}
          placeholder="—"
          widthClass="min-w-44"
          onSave={(raw) =>
            withOptimisticRow(
              lead.id,
              (r) => ({ ...r, discovery: { ...(r.discovery ?? blankDiscovery()), university: raw || null } }),
              () => saveDiscovery(lead.id, { student: { university: raw || null } })
            )
          }
        />
      ),
    },
    budget: {
      key: "budget",
      header: "Budget",
      render: (lead) => {
        const d = lead.discovery;
        // The backend requires a currency whenever a budget bound is set,
        // so all three always travel together.
        const saveBudget = (next: { budgetMin?: string; budgetMax?: string; currency?: string }) => {
          const min = next.budgetMin !== undefined ? next.budgetMin : d?.budgetMin != null ? String(d.budgetMin) : "";
          const max = next.budgetMax !== undefined ? next.budgetMax : d?.budgetMax != null ? String(d.budgetMax) : "";
          const cur = next.currency !== undefined ? next.currency : d?.currency ?? "";
          const minNum = min.trim() === "" ? null : Number(min);
          const maxNum = max.trim() === "" ? null : Number(max);
          const curVal = cur.trim() === "" ? null : cur.trim().toUpperCase();
          return withOptimisticRow(
            lead.id,
            (r) => ({
              ...r,
              discovery: { ...(r.discovery ?? blankDiscovery()), budgetMin: minNum, budgetMax: maxNum, currency: curVal },
            }),
            () => saveDiscovery(lead.id, { accommodation: { budgetMin: minNum, budgetMax: maxNum, currency: curVal } })
          );
        };
        return (
          <div className="flex items-center gap-0.5">
            <TextCell
              value={d?.currency ?? null}
              placeholder="CUR"
              widthClass="w-14"
              title="Currency (required when a budget is set)"
              onSave={(raw) => saveBudget({ currency: raw })}
            />
            <TextCell
              value={d?.budgetMin != null ? String(d.budgetMin) : null}
              type="number"
              placeholder="min"
              widthClass="w-20"
              onSave={(raw) => saveBudget({ budgetMin: raw })}
            />
            <span className="text-xs text-faint">–</span>
            <TextCell
              value={d?.budgetMax != null ? String(d.budgetMax) : null}
              type="number"
              placeholder="max"
              widthClass="w-20"
              onSave={(raw) => saveBudget({ budgetMax: raw })}
            />
          </div>
        );
      },
    },
    amberAvailability: {
      key: "amberAvailability",
      header: "Amber Availability",
      render: (lead) => partnerStatusCell(lead, "amber", withOptimisticRow),
    },
    amberReply: {
      key: "amberReply",
      header: "Amber Reply",
      render: (lead) => partnerReplyCell(lead, "amber", withOptimisticRow),
    },
    uhomesAvailability: {
      key: "uhomesAvailability",
      header: "uHomes Availability",
      render: (lead) => partnerStatusCell(lead, "uhomes", withOptimisticRow),
    },
    uhomesReply: {
      key: "uhomesReply",
      header: "uHomes Reply",
      render: (lead) => partnerReplyCell(lead, "uhomes", withOptimisticRow),
    },
    status: {
      key: "status",
      header: "Status",
      render: (lead) => (
        <SelectCell<LeadStatus>
          value={lead.status}
          options={LEAD_STATUSES}
          labelOf={formatLabel}
          onSave={(raw) =>
            withOptimisticRow(
              lead.id,
              (r) => ({ ...r, status: raw as LeadStatus }),
              () => updateLead(lead.id, { status: raw as LeadStatus })
            )
          }
        />
      ),
    },
    nextAction: { key: "nextAction", header: "Next Step", render: (lead) => <NextActionCell lead={lead} /> },
    summary: {
      key: "summary",
      header: "Summary",
      render: (lead) => (
        <TextCell
          value={lead.summary}
          placeholder="—"
          widthClass="min-w-56"
          onSave={(raw) =>
            withOptimisticRow(
              lead.id,
              (r) => ({ ...r, summary: raw || null }),
              () => updateLead(lead.id, { summary: raw || null })
            )
          }
        />
      ),
    },
    assignedTo: {
      key: "assignedTo",
      header: "Assigned Agent",
      render: (lead) => (
        <span className="whitespace-nowrap text-subtle">
          {lead.assignedTo ? staffById[lead.assignedTo]?.name || `Agent #${lead.assignedTo.slice(-6)}` : "Unassigned"}
        </span>
      ),
    },
  };

  const columns = COLUMN_ORDER.filter((c) => visible.has(c.key)).map((c) => allColumns[c.key]);

  return (
    <div className="flex flex-col gap-2">
      <ColumnsMenu visible={visible} onToggle={toggleColumn} />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(lead) => lead.id}
        isLoading={isLoading}
        emptyIcon={Users}
        emptyTitle={hasActiveFilters ? "No leads match this filter." : "No leads have been created yet."}
        emptyDescription={hasActiveFilters ? "Try a different quick filter or clear your filters." : "New leads will appear here as they arrive."}
        skeletonRows={8}
      />
      <p className="text-xs text-faint">
        Cells save when you tab or click away (Enter commits, Esc cancels). Next Step is derived from the lead&apos;s
        follow-ups — set it from the lead page.
      </p>
    </div>
  );
}

function blankDiscovery(): NonNullable<WorkQueueLead["discovery"]> {
  return { university: null, moveInDate: null, moveOutDate: null, budgetMin: null, budgetMax: null, currency: null };
}

const BLANK_PARTNER = { status: "not_requested" as PartnerAvailabilityStatus, reply: null, updatedAt: null, updatedBy: null };

type OptimisticRunner = (
  leadId: string,
  patch: (lead: WorkQueueLead) => WorkQueueLead,
  request: () => Promise<unknown>
) => Promise<void>;

function partnerBlock(lead: WorkQueueLead, partner: "amber" | "uhomes") {
  return lead.partnerAvailability?.[partner] ?? BLANK_PARTNER;
}

function patchPartner(lead: WorkQueueLead, partner: "amber" | "uhomes", change: { status?: PartnerAvailabilityStatus; reply?: string | null }) {
  const current = lead.partnerAvailability ?? { amber: BLANK_PARTNER, uhomes: BLANK_PARTNER };
  return {
    ...lead,
    partnerAvailability: { ...current, [partner]: { ...current[partner], ...change } },
  } as WorkQueueLead;
}

function partnerStatusCell(lead: WorkQueueLead, partner: "amber" | "uhomes", run: OptimisticRunner) {
  return (
    <SelectCell<PartnerAvailabilityStatus>
      value={partnerBlock(lead, partner).status}
      options={PARTNER_AVAILABILITY_STATUSES}
      labelOf={formatLabel}
      widthClass="min-w-36"
      onSave={(raw) =>
        run(
          lead.id,
          (r) => patchPartner(r, partner, { status: raw as PartnerAvailabilityStatus }),
          () => updateLead(lead.id, { partnerAvailability: { [partner]: { status: raw as PartnerAvailabilityStatus } } })
        )
      }
    />
  );
}

function partnerReplyCell(lead: WorkQueueLead, partner: "amber" | "uhomes", run: OptimisticRunner) {
  return (
    <TextCell
      value={partnerBlock(lead, partner).reply}
      placeholder="—"
      widthClass="min-w-48"
      onSave={(raw) =>
        run(
          lead.id,
          (r) => patchPartner(r, partner, { reply: raw || null }),
          () => updateLead(lead.id, { partnerAvailability: { [partner]: { reply: raw || null } } })
        )
      }
    />
  );
}
