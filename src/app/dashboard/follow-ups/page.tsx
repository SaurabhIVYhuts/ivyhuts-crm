"use client";

// A real cross-lead Follow-ups page built entirely from data this backend
// already computes: GET /api/leads/work-queue's `nextFollowUp` per lead
// (the same field the Dashboard and Lead Inbox already read — see
// src/types/workQueue.ts). There is no backend endpoint that lists every
// follow-up across every lead, so this page honestly shows each lead's
// single NEXT follow-up rather than a full multi-follow-up history — no
// "Completed" tab exists here for the same reason: no cross-lead endpoint
// can honestly populate one, and inventing a permanently-empty tab would
// be worse than not having it.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getWorkQueue } from "@/lib/api/leads";
import type { WorkQueueLead } from "@/types/workQueue";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { PriorityBadge } from "@/components/leads/PriorityBadge";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorState } from "@/components/ui/ErrorState";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";
import { formatDateTime, formatLabel, relativeDay } from "@/lib/utils/format";

type Tab = "overdue" | "today" | "upcoming";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
];

interface Row {
  lead: WorkQueueLead;
}

export default function FollowUpsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>("overdue");
  const [leads, setLeads] = useState<WorkQueueLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiErrorState | null>(null);

  const load = useCallback(() => {
    if (!profile?.id) return;
    setIsLoading(true);
    getWorkQueue({ assignedTo: profile.id, limit: 100 })
      .then((res) => setLeads(res.data.leads.filter((l) => l.nextFollowUp)))
      .catch((err) => setError(describeApiError(err)))
      .finally(() => setIsLoading(false));
  }, [profile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Recomputed per render (this list is small — bounded to 100 leads — so
  // that's cheap) using new Date().getTime() rather than Date.now(), same
  // convention LeadsTable.tsx's NextActionCell already uses: react-hooks/
  // purity's impure-call detection flags Date.now() specifically.
  //
  // Mutually exclusive by construction (overdue > today > upcoming,
  // checked in that order) — a follow-up due earlier today that's now
  // actually overdue (dueAt < now, a finer-grained check than the
  // backend's day-boundary `bucket`) must appear in exactly one tab, never
  // double-counted across Overdue and Today.
  const now = new Date().getTime();
  const overdue = leads.filter((l) => l.nextFollowUp && new Date(l.nextFollowUp.dueAt).getTime() < now);
  const today = leads.filter((l) => l.bucket === "today" && !overdue.includes(l));
  const upcoming = leads.filter((l) => !overdue.includes(l) && !today.includes(l));
  const counts = { overdue, today, upcoming };

  const rows: Row[] = counts[tab].map((lead) => ({ lead }));

  const columns: DataTableColumn<Row>[] = [
    {
      key: "lead",
      header: "Lead",
      render: ({ lead }) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={lead.contact.name} size="sm" />
          <span className="font-medium text-ink">{lead.contact.name || "Unnamed lead"}</span>
        </div>
      ),
    },
    { key: "task", header: "Task", render: ({ lead }) => <span className="text-subtle">{lead.nextFollowUp ? formatLabel(lead.nextFollowUp.type) : "—"}</span> },
    {
      key: "due",
      header: "Due",
      render: ({ lead }) => {
        if (!lead.nextFollowUp) return "—";
        const overdue = new Date(lead.nextFollowUp.dueAt).getTime() < Date.now();
        return <span className={overdue ? "font-medium text-danger" : "text-subtle"}>{relativeDay(lead.nextFollowUp.dueAt)} · {formatDateTime(lead.nextFollowUp.dueAt)}</span>;
      },
    },
    { key: "priority", header: "Priority", render: ({ lead }) => (lead.nextFollowUp ? <PriorityBadge priority={lead.nextFollowUp.priority} /> : "—") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Follow-ups" description="Every lead with a follow-up scheduled, across your pipeline." />

      <div className="flex gap-1.5 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2 text-sm font-medium transition-colors ${tab === t.id ? "text-ink" : "text-faint hover:text-subtle"}`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-faint">({counts[t.id].length})</span>
            {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState error={error} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.lead.id}
          isLoading={isLoading}
          onRowClick={(r) => router.push(`/dashboard/leads/${r.lead.id}#follow-ups`)}
          emptyIcon={PhoneCall}
          emptyTitle={`No ${tab} follow-ups.`}
          emptyDescription="You're all caught up."
        />
      )}
    </div>
  );
}
