"use client";

// The Lead Inbox grid — CRM plan item 2. Every business field the team
// works day to day lives here and is editable in place, spreadsheet-style:
// type in a cell, tab or click away, it saves. Nothing is batched behind a
// Save button, and nothing saves per keystroke — text commits on blur or
// Enter, selects commit on change.
//
// Edits fan out to the endpoints that own each field:
//   PATCH /api/leads/:id            — contact, city, status, summary,
//                                     partner availability
//   PUT   /api/leads/:id/discovery  — university, move-in, budget (a
//                                     partial upsert-merge)
//   PATCH /api/leads/:id/assignment — assigned agent (assignedTo is
//                                     immutable on the PATCH above, so it
//                                     has its own endpoint)
//   POST/PATCH /api/leads/:id/follow-ups[/:followUpId]
//                                   — next step (schedules or reschedules
//                                     the lead's next follow-up)
// The row is updated optimistically and reverted if the request fails, so
// the grid never shows a value the backend didn't accept.
//
// The whole grid fits the page width — no sideways scrolling. The table is
// fixed-layout, so a long value clips inside its own cell (full text on
// hover) instead of widening the table. Only fields that are one idea
// share a column (a lead's number and email, a budget's range and
// currency, a partner's status and reply); everything else gets its own.
//
// The same grid renders Leads (New and Lost) and Good Leads (being
// worked). `belongs` tells it which rows are its own, so a status change
// that moves a lead to the other page takes the row off this one the
// moment the backend accepts it.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, MoreHorizontal, Plus, SlidersHorizontal, Users } from "lucide-react";
import type { WorkQueueLead, WorkQueueNextFollowUp } from "@/types/workQueue";
import type { StaffUser } from "@/types/staff";
import {
  LEAD_STATUSES,
  PARTNER_AVAILABILITY_STATUSES,
  type LeadStatus,
  type PartnerAvailabilityStatus,
} from "@/types/lead";
import { FOLLOWUP_TYPES, type FollowUpType } from "@/types/followUp";
import { assignLead, updateLead } from "@/lib/api/leads";
import { createFollowUp, updateFollowUp } from "@/lib/api/followUps";
import { saveDiscovery } from "@/lib/api/discovery";
import { TYPE_ICONS } from "@/components/follow-ups/NextActionCard";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { SelectCell, TextCell } from "@/components/leads/EditableCells";
import { formatDate, formatTime, formatLabel, relativeDay, relativeTimeFromNow } from "@/lib/utils/format";

// Reuses NextActionCard's own overdue rule (dueAt < now, not day-boundary)
// since this is the same "is this specific follow-up currently overdue"
// question that component already answers for the Lead Detail page — a
// lead's `bucket` field (day-boundary, from the backend's work-queue
// aggregation) drives which PILE this row sorts into, but the per-row
// red/not-red styling here mirrors the finer-grained, already-shipped
// NextActionCard convention so the two views never visually disagree about
// a follow-up due earlier today.
// Exported for reuse by the Dashboard's Today agenda (CRM Milestone 16) —
// same overdue-icon-type-time rendering, not a second copy. The agenda
// keeps it small and on one line; the grid passes `dense` for its 13px text
// that wraps inside a narrow column.
export function NextActionCell({ lead, dense = false }: { lead: WorkQueueLead; dense?: boolean }) {
  const text = dense ? "text-[13px]" : "whitespace-nowrap text-xs";
  if (!lead.nextFollowUp) {
    return <span className={`inline-flex items-center gap-1 text-warning ${text}`}>No next action</span>;
  }
  const { type, dueAt } = lead.nextFollowUp;
  const Icon = TYPE_ICONS[type] || MoreHorizontal;
  const overdue = new Date(dueAt).getTime() < new Date().getTime();
  return (
    <div className={`flex items-center gap-1.5 ${text} ${overdue ? "text-danger" : "text-subtle"}`}>
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

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in LOCAL time —
// an ISO string's UTC clock would show the agent the wrong hour.
function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Where a brand-new next step starts: tomorrow, 10:00 local.
function defaultNextStepDue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

type LeadColumnKey =
  | "lead"
  | "contact"
  | "moveIn"
  | "city"
  | "university"
  | "budget"
  | "amber"
  | "uhomes"
  | "status"
  | "agent"
  | "next"
  | "summary";

// Order here is the on-screen order. Widths are shares of the table's full
// width (the table is fixed-layout), so they sum to 100% and the grid can
// never grow wider than the page; hiding a column hands its share to the
// rest proportionally.
const COLUMN_ORDER: Array<{ key: LeadColumnKey; label: string; width: string }> = [
  { key: "lead", label: "Lead", width: "9.5%" },
  { key: "contact", label: "Contact", width: "11%" },
  { key: "moveIn", label: "Move-in", width: "8.5%" },
  { key: "city", label: "City", width: "6%" },
  { key: "university", label: "University", width: "8%" },
  { key: "budget", label: "Budget", width: "12%" },
  { key: "amber", label: "Amber", width: "8%" },
  { key: "uhomes", label: "uHomes", width: "8%" },
  { key: "status", label: "Status", width: "7%" },
  { key: "agent", label: "Agent", width: "7%" },
  { key: "next", label: "Next Step", width: "7%" },
  { key: "summary", label: "Summary", width: "8%" },
];

// Versioned: v4 split the "a / b" columns and dropped departure, so a
// stored v3 set names keys that no longer exist.
const STORAGE_KEY = "ivyhuts-crm:leads-columns:v4";

function readStoredColumns(): Set<LeadColumnKey> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return null;
    const valid = new Set(COLUMN_ORDER.map((c) => c.key as string));
    const stored = new Set(parsed.filter((k) => valid.has(k)) as LeadColumnKey[]);
    stored.add("lead"); // the identity column can't be hidden
    return stored;
  } catch {
    return null;
  }
}

function defaultVisible(): Set<LeadColumnKey> {
  return new Set(COLUMN_ORDER.map((c) => c.key));
}

// Fills its (fixed-width) column and may shrink below its natural size —
// the one width every grid cell uses.
const FULL = "w-full min-w-0";

// Two fields that are one idea, sharing a column one above the other.
function Stack({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-0.5">{children}</div>;
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

// Next Step is a real follow-up, not free text: the lead's earliest pending
// one (work-queue's nextFollowUp). Editing it here reschedules THAT
// follow-up — type and date/time — or, when the lead has none pending,
// schedules a new one. A type picker plus a date-and-time input don't fit
// a narrow grid column (and the cell clips), so the editor opens in a small
// panel fixed to the viewport just under the cell.
const PANEL_WIDTH = 260;

function NextStepCell({ lead, onSaved }: { lead: WorkQueueLead; onSaved: (next: WorkQueueNextFollowUp) => void }) {
  const next = lead.nextFollowUp;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [type, setType] = useState<FollowUpType>("call");
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  function openEditor() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8)) });
    setType(next?.type ?? "call");
    setWhen(toDateTimeLocal(next?.dueAt ?? defaultNextStepDue()));
    setError(null);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    // The panel is positioned against the viewport, so a scroll or resize
    // would leave it floating away from its cell — close instead.
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  async function save() {
    if (!when) {
      setError("Pick a date and time.");
      return;
    }
    const dueAt = new Date(when).toISOString();
    setSaving(true);
    setError(null);
    try {
      const res = next
        ? await updateFollowUp(lead.id, next.id, { type, dueAt })
        : await createFollowUp(lead.id, { type, dueAt });
      const fu = res.data;
      onSaved({ id: fu.id, type: fu.type, priority: fu.priority, dueAt: fu.dueAt });
      setPos(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openEditor}
        title={next ? "Change next step" : "Set next step"}
        className="w-full rounded-md border border-transparent px-1.5 py-1 text-left hover:border-line"
      >
        {next ? (
          <NextActionCell lead={lead} dense />
        ) : (
          <span className="inline-flex items-center gap-1 text-[13px] text-warning">
            <Plus className="h-3.5 w-3.5 shrink-0" />
            Set next step
          </span>
        )}
      </button>
      {open && pos && (
        <div
          ref={panelRef}
          style={{ top: pos.top, left: pos.left, width: PANEL_WIDTH }}
          className="fixed z-50 flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-3 shadow-xl"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-faint">{next ? "Change next step" : "Set next step"}</div>
          <label className="flex flex-col gap-1 text-xs text-subtle">
            What
            <select
              value={type}
              onChange={(e) => setType(e.target.value as FollowUpType)}
              disabled={saving}
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
            >
              {FOLLOWUP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {formatLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-subtle">
            When
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              disabled={saving}
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPos(null)}
              disabled={saving}
              className="rounded-md border border-line px-2.5 py-1 text-xs text-subtle hover:bg-surface-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-strong disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function LeadsTable({
  leads,
  isLoading,
  hasActiveFilters,
  staffById,
  belongs,
  onMoved,
  emptyTitle,
  emptyDescription,
}: {
  leads: WorkQueueLead[];
  isLoading: boolean;
  hasActiveFilters: boolean;
  staffById: Record<string, StaffUser>;
  // Which rows this page owns. After a successful status save, a row that
  // no longer belongs is removed and reported through onMoved, so the page
  // can say where it went and refresh its counts.
  belongs?: (lead: WorkQueueLead) => boolean;
  onMoved?: (lead: WorkQueueLead) => void;
  // Empty-state copy for when no filter is active (a filtered empty state
  // always says "no match").
  emptyTitle: string;
  emptyDescription: string;
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

  // "" first so Unassigned is the top option, then staff by name. The
  // backend re-verifies the target is a real internal user, so a stale
  // staff list here can never make a bad assignment stick.
  const staffOptions = useMemo(
    () => ["", ...Object.values(staffById).sort((a, b) => a.name.localeCompare(b.name)).map((s) => s.id)],
    [staffById]
  );
  const agentLabel = (id: string) => (id === "" ? "Unassigned" : staffById[id]?.name || `Agent #${id.slice(-6)}`);

  const allColumns: Record<LeadColumnKey, Omit<DataTableColumn<WorkQueueLead>, "width">> = {
    lead: {
      key: "lead",
      header: "Lead",
      render: (lead) => (
        <div className="flex min-w-0 items-start gap-0.5">
          <Link
            href={`/dashboard/leads/${lead.id}`}
            title="Open lead"
            className="mt-1.5 shrink-0 rounded p-0.5 text-faint hover:bg-surface-2 hover:text-accent"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Stack>
            <TextCell
              value={lead.contact.name}
              placeholder="Unnamed lead"
              title={lead.contact.name || undefined}
              widthClass={FULL}
              onSave={(raw) =>
                withOptimisticRow(
                  lead.id,
                  (r) => ({ ...r, contact: { ...r.contact, name: raw || null } }),
                  () => updateLead(lead.id, { contact: { name: raw || null } })
                )
              }
            />
            <span className="truncate px-1.5 text-xs text-faint" title={`Arrived ${formatDate(lead.createdAt)}`}>
              {relativeTimeFromNow(lead.createdAt)}
            </span>
          </Stack>
        </div>
      ),
    },
    contact: {
      key: "contact",
      header: "Contact",
      render: (lead) => (
        <Stack>
          <TextCell
            value={lead.contact.phone}
            type="tel"
            size="dense"
            placeholder="Number"
            title={lead.contact.phone || "Phone number"}
            widthClass={FULL}
            onSave={(raw) =>
              withOptimisticRow(
                lead.id,
                (r) => ({ ...r, contact: { ...r.contact, phone: raw || null } }),
                () => updateLead(lead.id, { contact: { phone: raw || null } })
              )
            }
          />
          <TextCell
            value={lead.contact.email}
            type="email"
            size="dense"
            placeholder="Email"
            title={lead.contact.email || "Email"}
            widthClass={FULL}
            onSave={(raw) =>
              withOptimisticRow(
                lead.id,
                (r) => ({ ...r, contact: { ...r.contact, email: raw || null } }),
                () => updateLead(lead.id, { contact: { email: raw || null } })
              )
            }
          />
        </Stack>
      ),
    },
    moveIn: {
      key: "moveIn",
      header: "Move-in",
      render: (lead) => (
        <TextCell
          value={toDateInput(lead.discovery?.moveInDate)}
          type="date"
          size="dense"
          title="Move-in date"
          widthClass={FULL}
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
    city: {
      key: "city",
      header: "City",
      render: (lead) => (
        <TextCell
          value={lead.property.city}
          size="dense"
          placeholder="—"
          title={lead.property.city || "City"}
          widthClass={FULL}
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
          size="dense"
          placeholder="—"
          title={lead.discovery?.university || "University"}
          widthClass={FULL}
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
        const currency = d?.currency ?? "";
        // A saved code outside the list (typed on the lead page, or legacy
        // data) still has to be a real option, or the select shows blank.
        const currencyOptions = currency && !CURRENCIES.includes(currency) ? ["", ...CURRENCIES, currency] : ["", ...CURRENCIES];
        return (
          <Stack>
            {/* Currency first: the backend rejects a budget without one, so
                picking it before typing a price means the price saves. */}
            <SelectCell<string>
              value={currency}
              options={currencyOptions}
              labelOf={(c) => c || "Currency"}
              size="dense"
              title="Currency (required when a budget is set)"
              widthClass={FULL}
              onSave={(raw) => saveBudget({ currency: raw })}
            />
            <div className="flex min-w-0 items-center gap-1">
              <TextCell
                value={d?.budgetMin != null ? String(d.budgetMin) : null}
                type="number"
                size="dense"
                placeholder="min"
                title={d?.budgetMin != null ? `Minimum budget: ${d.budgetMin}` : "Minimum budget"}
                widthClass={FULL}
                onSave={(raw) => saveBudget({ budgetMin: raw })}
              />
              <span className="shrink-0 text-xs text-faint">–</span>
              <TextCell
                value={d?.budgetMax != null ? String(d.budgetMax) : null}
                type="number"
                size="dense"
                placeholder="max"
                title={d?.budgetMax != null ? `Maximum budget: ${d.budgetMax}` : "Maximum budget"}
                widthClass={FULL}
                onSave={(raw) => saveBudget({ budgetMax: raw })}
              />
            </div>
          </Stack>
        );
      },
    },
    amber: { key: "amber", header: "Amber", render: (lead) => partnerCell(lead, "amber", withOptimisticRow) },
    uhomes: { key: "uhomes", header: "uHomes", render: (lead) => partnerCell(lead, "uhomes", withOptimisticRow) },
    status: {
      key: "status",
      header: "Status",
      render: (lead) => (
        <SelectCell<LeadStatus>
          value={lead.status}
          options={LEAD_STATUSES}
          labelOf={formatLabel}
          size="dense"
          title="Status"
          widthClass={FULL}
          onSave={async (raw) => {
            const status = raw as LeadStatus;
            await withOptimisticRow(
              lead.id,
              (r) => ({ ...r, status }),
              () => updateLead(lead.id, { status })
            );
            // Saved — if the new status belongs to the other page (Leads
            // <-> Good Leads), the row leaves this one.
            const moved = { ...lead, status };
            if (belongs && !belongs(moved)) {
              setRows((prev) => prev.filter((r) => r.id !== lead.id));
              onMoved?.(moved);
            }
          }}
        />
      ),
    },
    agent: {
      key: "agent",
      header: "Agent",
      render: (lead) => {
        const current = lead.assignedTo ?? "";
        // An assignee missing from the staff list (they left the team, or
        // the list simply failed to load) still has to be a real option —
        // otherwise the select renders blank and the next edit looks like
        // an accidental unassign.
        const agentOptions = current && !staffOptions.includes(current) ? [...staffOptions, current] : staffOptions;
        return (
          <SelectCell<string>
            value={current}
            options={agentOptions}
            labelOf={agentLabel}
            size="dense"
            title="Assigned agent"
            widthClass={FULL}
            onSave={(raw) =>
              withOptimisticRow(
                lead.id,
                (r) => ({ ...r, assignedTo: raw || null }),
                () => assignLead(lead.id, raw || null)
              )
            }
          />
        );
      },
    },
    next: {
      key: "next",
      header: "Next Step",
      render: (lead) => (
        <NextStepCell
          lead={lead}
          onSaved={(nextFollowUp) => setRows((prev) => prev.map((r) => (r.id === lead.id ? { ...r, nextFollowUp } : r)))}
        />
      ),
    },
    summary: {
      key: "summary",
      header: "Summary",
      render: (lead) => (
        <TextCell
          value={lead.summary}
          multiline
          size="dense"
          placeholder="Add a summary"
          title={lead.summary || "One-line status summary"}
          widthClass={FULL}
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
  };

  const columns: DataTableColumn<WorkQueueLead>[] = COLUMN_ORDER.filter((c) => visible.has(c.key)).map((c) => ({
    ...allColumns[c.key],
    width: c.width,
  }));

  return (
    <div className="flex flex-col gap-2">
      <ColumnsMenu visible={visible} onToggle={toggleColumn} />
      <DataTable
        fit
        columns={columns}
        rows={rows}
        rowKey={(lead) => lead.id}
        isLoading={isLoading}
        emptyIcon={Users}
        emptyTitle={hasActiveFilters ? "No leads match this filter." : emptyTitle}
        emptyDescription={hasActiveFilters ? "Try a different quick filter or clear your filters." : emptyDescription}
        skeletonRows={8}
        rowClassName={(lead) => (lead.status === "lost" ? "bg-danger/10 text-danger" : "")}
      />
      <p className="text-xs text-faint">
        Cells save when you tab or click away (Enter commits, Esc cancels). Hover a cell to see its full text. Click
        Next Step to set or reschedule it. Moving a lead to Contacted or beyond sends it to Good Leads; New and Lost
        leads stay on Leads.
      </p>
    </div>
  );
}

function blankDiscovery(): NonNullable<WorkQueueLead["discovery"]> {
  return { university: null, moveInDate: null, moveOutDate: null, budgetMin: null, budgetMax: null, currency: null };
}

const BLANK_PARTNER = { status: "not_requested" as PartnerAvailabilityStatus, reply: null, updatedAt: null, updatedBy: null };

// Where IVYHUTS students study, most common first. The backend accepts any
// code, so this is a convenience list, not a rule — and a code saved from
// elsewhere still shows (see the Budget cell).
const CURRENCIES = ["GBP", "EUR", "USD", "AUD", "CAD", "NZD", "SGD", "AED", "CHF", "INR"];

// Short enough to fit a narrow column without clipping.
const PARTNER_STATUS_LABELS: Record<PartnerAvailabilityStatus, string> = {
  not_requested: "Not asked",
  requested: "Requested",
  available: "Available",
  unavailable: "Unavailable",
  no_reply: "No reply",
};

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

// A partner's availability status stacked over its reply.
function partnerCell(lead: WorkQueueLead, partner: "amber" | "uhomes", run: OptimisticRunner) {
  const block = partnerBlock(lead, partner);
  const name = partner === "amber" ? "Amber" : "uHomes";
  return (
    <Stack>
      <SelectCell<PartnerAvailabilityStatus>
        value={block.status}
        options={PARTNER_AVAILABILITY_STATUSES}
        labelOf={(s) => PARTNER_STATUS_LABELS[s]}
        size="dense"
        title={`${name} availability`}
        widthClass={FULL}
        onSave={(raw) =>
          run(
            lead.id,
            (r) => patchPartner(r, partner, { status: raw as PartnerAvailabilityStatus }),
            () => updateLead(lead.id, { partnerAvailability: { [partner]: { status: raw as PartnerAvailabilityStatus } } })
          )
        }
      />
      <TextCell
        value={block.reply}
        size="dense"
        placeholder="Reply"
        title={block.reply || `${name}'s reply`}
        widthClass={FULL}
        onSave={(raw) =>
          run(
            lead.id,
            (r) => patchPartner(r, partner, { reply: raw || null }),
            () => updateLead(lead.id, { partnerAvailability: { [partner]: { reply: raw || null } } })
          )
        }
      />
    </Stack>
  );
}
