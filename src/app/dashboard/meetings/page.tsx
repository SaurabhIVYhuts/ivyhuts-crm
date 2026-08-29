"use client";

// A real cross-lead Meetings page, same honest-data-source rule as the
// Follow-ups page: GET /api/leads/work-queue's `nextMeeting` per lead (the
// earliest still-SCHEDULED meeting) is the only cross-lead meeting signal
// this backend computes. No "Completed" list view exists here for the same
// reason — completed/cancelled meeting history is only ever available per
// lead (see MeetingsSection on the Lead Detail page), never aggregated.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Video } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getWorkQueue } from "@/lib/api/leads";
import type { WorkQueueLead } from "@/types/workQueue";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorState } from "@/components/ui/ErrorState";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";
import { formatDateTime, relativeDay } from "@/lib/utils/format";

type Tab = "today" | "upcoming";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
];

export default function MeetingsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>("today");
  const [leads, setLeads] = useState<WorkQueueLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiErrorState | null>(null);

  const load = useCallback(() => {
    if (!profile?.id) return;
    setIsLoading(true);
    getWorkQueue({ assignedTo: profile.id, limit: 100 })
      .then((res) => setLeads(res.data.leads.filter((l) => l.nextMeeting)))
      .catch((err) => setError(describeApiError(err)))
      .finally(() => setIsLoading(false));
  }, [profile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const counts = useMemo(() => {
    const today = leads.filter((l) => l.bucket === "meetingToday");
    const upcoming = leads.filter((l) => l.bucket !== "meetingToday");
    return { today, upcoming };
  }, [leads]);

  const rows = counts[tab];

  const columns: DataTableColumn<WorkQueueLead>[] = [
    {
      key: "lead",
      header: "Lead",
      render: (lead) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={lead.contact.name} size="sm" />
          <span className="font-medium text-ink">{lead.contact.name || "Unnamed lead"}</span>
        </div>
      ),
    },
    {
      key: "when",
      header: "When",
      render: (lead) => (lead.nextMeeting ? <span className="text-subtle">{relativeDay(lead.nextMeeting.scheduledAt)} · {formatDateTime(lead.nextMeeting.scheduledAt)}</span> : "—"),
    },
    { key: "agent", header: "Assigned Agent", render: (lead) => <span className="text-subtle">{lead.assignedTo ? "You" : "Unassigned"}</span> },
    {
      key: "action",
      header: "",
      render: () => (
        <span className="flex items-center gap-1.5 text-xs font-medium text-accent-strong">
          <Video className="h-3.5 w-3.5" />
          Open meeting
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Meetings" description="Every upcoming meeting across your pipeline." />

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
          rowKey={(lead) => lead.id}
          isLoading={isLoading}
          onRowClick={(lead) => router.push(`/dashboard/leads/${lead.id}#meeting`)}
          emptyIcon={CalendarClock}
          emptyTitle={`No meetings ${tab === "today" ? "today" : "coming up"}.`}
        />
      )}
    </div>
  );
}
