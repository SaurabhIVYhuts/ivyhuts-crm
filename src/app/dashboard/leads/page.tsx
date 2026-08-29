"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { getWorkQueue, listLeads, syncLeadsFromSheet } from "@/lib/api/leads";
import { ApiRequestError } from "@/lib/api/client";
import { listStaff } from "@/lib/api/staff";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import type { StaffUser } from "@/types/staff";
import { WORK_QUEUE_BUCKETS, type WorkQueueLead, type WorkQueueSummary, type WorkQueueBucket } from "@/types/workQueue";
import { LeadFilters, type LeadFilterValues } from "@/components/leads/LeadFilters";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { AddLeadModal } from "@/components/leads/AddLeadModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";
import { relativeTimeFromNow } from "@/lib/utils/format";
import type { PaginationMeta } from "@/types/api";

const PAGE_SIZE = 25;
const EMPTY_FILTERS: LeadFilterValues = { search: "", status: "", source: "", assignedTo: "" };
// A per-viewer convenience only (survives a page reload in this browser) —
// the real source of truth for "was this actually synced" is the
// backend's own syncedAt on each response and the scheduled cron that
// keeps running regardless of whether anyone ever opens this page.
const LAST_SYNCED_STORAGE_KEY = "ivyhuts-crm:leads-last-synced-at";

function readStoredLastSynced(): string | null {
  try {
    return localStorage.getItem(LAST_SYNCED_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredLastSynced(iso: string) {
  try {
    localStorage.setItem(LAST_SYNCED_STORAGE_KEY, iso);
  } catch {
    // Best-effort only — a blocked/unavailable localStorage must never
    // break the sync action itself, just the "remember it next visit" nicety.
  }
}

// CRM Milestone 11: these are work-priority quick filters (backed by GET
// /api/leads/work-queue's `bucket` param), distinct from the Lead lifecycle
// `status` filter already offered by LeadFilters below — a lead can be
// "contacted" AND "overdue" at the same time. Order matches
// BUCKET_SORT_RANK in api/leads/work-queue.js exactly.
const PRIORITY_PILLS: Array<{ label: string; value: WorkQueueBucket }> = [
  { label: "Overdue", value: "overdue" },
  { label: "Meeting Today", value: "meetingToday" },
  { label: "Today", value: "today" },
  { label: "New", value: "new" },
  { label: "Needs Requirements", value: "discoveryIncomplete" },
  { label: "Ready for Find Rooms", value: "readyForFindRooms" },
  { label: "Presentation, No Follow-up", value: "presentationNoFollowUp" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Nurturing", value: "nurturing" },
  { label: "No Next Action", value: "noNextAction" },
];

function isWorkQueueBucket(value: string): value is WorkQueueBucket {
  return (WORK_QUEUE_BUCKETS as readonly string[]).includes(value);
}

// CRM Milestone 16 — lets the Dashboard deep-link into a pre-filtered Lead
// Inbox (e.g. `/dashboard/leads?bucket=overdue`, `?assignedTo=unassigned`)
// by reading these two params ONCE on mount.
function useInitialFilters(): { bucket: WorkQueueBucket | ""; assignedTo: string } {
  const searchParams = useSearchParams();
  const bucketParam = searchParams.get("bucket") || "";
  const assignedToParam = searchParams.get("assignedTo") || "";
  return {
    bucket: isWorkQueueBucket(bucketParam) ? bucketParam : "",
    assignedTo: assignedToParam,
  };
}

function PillButton({ active, warning, count, onClick, children }: { active: boolean; warning?: boolean; count?: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? warning
            ? "bg-danger text-white"
            : "bg-accent text-white"
          : warning && count
            ? "border border-danger/30 text-danger hover:bg-danger/10"
            : "border border-line text-subtle hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {children}
      {typeof count === "number" && <span className="ml-1 opacity-80">({count})</span>}
    </button>
  );
}

function LeadInboxContent() {
  const { profile } = useAuth();
  const { show } = useToast();
  const initial = useInitialFilters();
  const [filters, setFilters] = useState<LeadFilterValues>({ ...EMPTY_FILTERS, assignedTo: initial.assignedTo });
  const [bucket, setBucket] = useState<WorkQueueBucket | "">(initial.bucket);
  const [page, setPage] = useState(1);
  const [leads, setLeads] = useState<WorkQueueLead[]>([]);
  const [summary, setSummary] = useState<WorkQueueSummary | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiErrorState | null>(null);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  // Lazy initializer (not an effect) so this never needs a synchronous
  // setState-after-mount round trip — guarded for SSR, where `window`
  // doesn't exist yet during the initial render pass.
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => (typeof window === "undefined" ? null : readStoredLastSynced()));

  // Distinct source values seen across a representative sample of real
  // leads (the backend has no "list distinct sources" endpoint).
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])) as Record<string, StaffUser>, [staff]);

  useEffect(() => {
    listLeads({ limit: 100 })
      .then((res) => {
        const sources = new Set<string>();
        res.data.forEach((lead) => {
          if (lead.source) sources.add(lead.source);
        });
        setSourceOptions([...sources].sort());
      })
      .catch(() => {
        // Filter option discovery is best-effort — the main list load
        // below surfaces the real error state.
      });
    listStaff()
      .then((res) => setStaff(res.data))
      .catch(() => {
        // Best-effort — the table just falls back to a truncated id.
      });
  }, []);

  function handleFiltersChange(next: LeadFilterValues) {
    setFilters(next);
    setPage(1);
  }

  function handleBucketChange(next: WorkQueueBucket | "") {
    setBucket((current) => (current === next ? "" : next));
    setPage(1);
  }

  function reload() {
    setIsLoading(true);
    setError(null);
    getWorkQueue({
      page,
      limit: PAGE_SIZE,
      search: filters.search || undefined,
      status: (filters.status || undefined) as WorkQueueLead["status"] | undefined,
      source: filters.source || undefined,
      assignedTo: filters.assignedTo || undefined,
      bucket: bucket || undefined,
    })
      .then((res) => {
        setLeads(res.data.leads);
        setSummary(res.data.summary);
        setPagination(res.data.pagination);
      })
      .catch((err) => setError(describeApiError(err)))
      .finally(() => setIsLoading(false));
  }

  // "Refresh Leads" — manually triggers the exact same Google Sheet sync
  // that also runs on a schedule in the background (see
  // api/leads/import/sync-cron.js on the backend), so a newly added
  // spreadsheet row shows up here immediately rather than waiting for the
  // next scheduled run. Idempotent on the backend (dedupes on
  // externalLeadId, never overwrites a CRM-edited field), so clicking this
  // repeatedly is always safe.
  async function handleSync() {
    setIsSyncing(true);
    try {
      const res = await syncLeadsFromSheet();
      const { created, merged } = res.data.summary;
      if (created > 0 || merged > 0) {
        show(`Synced — ${created} new lead${created === 1 ? "" : "s"}${merged > 0 ? `, ${merged} updated` : ""}.`);
      } else {
        show("Synced — no new leads.");
      }
      setLastSyncedAt(res.data.syncedAt);
      writeStoredLastSynced(res.data.syncedAt);
      reload();
    } catch (err) {
      const message =
        err instanceof ApiRequestError && err.status === 503
          ? err.message // the backend's real, specific reason (e.g. "Google Sheets import is not configured on this deployment.")
          : describeApiError(err).message;
      show(message, "error");
    } finally {
      setIsSyncing(false);
    }
  }

  // Debounce the free-text search so we're not firing a request per
  // keystroke; other filters/page changes fetch immediately. One request
  // returns both the paginated table AND the priority-pill badge counts.
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(
      () => {
        setIsLoading(true);
        setError(null);
        getWorkQueue({
          page,
          limit: PAGE_SIZE,
          search: filters.search || undefined,
          status: (filters.status || undefined) as WorkQueueLead["status"] | undefined,
          source: filters.source || undefined,
          assignedTo: filters.assignedTo || undefined,
          bucket: bucket || undefined,
        })
          .then((res) => {
            if (cancelled) return;
            setLeads(res.data.leads);
            setSummary(res.data.summary);
            setPagination(res.data.pagination);
          })
          .catch((err) => {
            if (!cancelled) setError(describeApiError(err));
          })
          .finally(() => {
            if (!cancelled) setIsLoading(false);
          });
      },
      filters.search ? 300 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [page, filters.status, filters.source, filters.assignedTo, filters.search, bucket]);

  const hasActiveFilters = useMemo(
    () => Boolean(filters.search || filters.status || filters.source || filters.assignedTo || bucket),
    [filters, bucket]
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Leads"
        description="Manage and track your sales pipeline."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={handleSync} disabled={isSyncing} iconClassName={isSyncing ? "animate-spin" : undefined}>
              {isSyncing ? "Syncing…" : "Refresh Leads"}
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setAddLeadOpen(true)}>
              Add Lead
            </Button>
          </>
        }
      />
      <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-faint">
        <span>{pagination ? `${pagination.total.toLocaleString()} total` : "Loading…"}</span>
        {lastSyncedAt && (
          <>
            <span aria-hidden="true">·</span>
            <span>Last synced: {relativeTimeFromNow(lastSyncedAt)}</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[
          { label: "All Leads", value: "" },
          { label: "My Leads", value: profile?.id || "" },
          { label: "Unassigned", value: "unassigned" },
        ].map(({ label, value }) => (
          <button
            key={label}
            type="button"
            disabled={label === "My Leads" && !profile?.id}
            onClick={() => handleFiltersChange({ ...filters, assignedTo: value })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
              filters.assignedTo === value ? "bg-ink text-canvas" : "border border-line text-subtle hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRIORITY_PILLS.map(({ label, value }) => (
          <PillButton
            key={value}
            active={bucket === value}
            warning={value === "overdue" || value === "noNextAction"}
            count={summary?.[value]}
            onClick={() => handleBucketChange(value)}
          >
            {label}
          </PillButton>
        ))}
      </div>

      <LeadFilters values={filters} onChange={handleFiltersChange} sourceOptions={sourceOptions} staffOptions={staff} />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <LeadsTable leads={leads} isLoading={isLoading} hasActiveFilters={hasActiveFilters} staffById={staffById} />

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-subtle">
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {addLeadOpen && (
        <AddLeadModal
          onClose={() => setAddLeadOpen(false)}
          onCreated={() => {
            setAddLeadOpen(false);
            show("Lead created.");
            reload();
          }}
        />
      )}
    </div>
  );
}

// useSearchParams (inside LeadInboxContent, via useInitialFilters) requires
// a Suspense boundary — see node_modules/next/dist/docs/01-app/03-api-reference/
// 04-functions/use-search-params.md's "Prerendering" section.
export default function LeadInboxPage() {
  return (
    <Suspense fallback={null}>
      <LeadInboxContent />
    </Suspense>
  );
}
