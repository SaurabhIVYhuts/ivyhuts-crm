"use client";

// One view, two pages. The sales pipeline is split by status:
//   Leads       /dashboard/leads       — New (waiting for first contact)
//                                        and Lost, shown in red. The inbox.
//   Good Leads  /dashboard/good-leads  — contacted, qualified, nurturing,
//                                        converted: the leads worth working.
// Lost leads stay on Leads by design — they never count as good leads.
// Both render this same grid, filters and priority pills, scoped by a
// status list the backend's work-queue accepts comma-separated. Changing a
// lead's status moves it to whichever page owns the new status: the grid
// drops the row the moment the save succeeds (see LeadsTable's `belongs`)
// and this view refreshes so the counts follow.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { getWorkQueue, listLeads, syncLeadsFromSheet } from "@/lib/api/leads";
import { ApiRequestError } from "@/lib/api/client";
import { listStaff } from "@/lib/api/staff";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import type { StaffUser } from "@/types/staff";
import type { LeadStatus } from "@/types/lead";
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

export type LeadListScope = "inbox" | "good";

interface ScopeConfig {
  title: string;
  href: string;
  description: string;
  statuses: readonly LeadStatus[];
  emptyTitle: string;
  emptyDescription: string;
  // Adding a lead and the sheet sync only ever produce New leads, so their
  // buttons live on the inbox alone.
  canCreate: boolean;
}

// Every status belongs to exactly one page.
const SCOPES: Record<LeadListScope, ScopeConfig> = {
  inbox: {
    title: "Leads",
    href: "/dashboard/leads",
    description: "New leads waiting for first contact, plus lost leads in red. Move a lead to Contacted or beyond and it goes to Good Leads.",
    statuses: ["new", "lost"],
    emptyTitle: "No new leads waiting.",
    emptyDescription: "New leads appear here as they arrive, and move to Good Leads once you've reached out.",
    canCreate: true,
  },
  good: {
    title: "Good Leads",
    href: "/dashboard/good-leads",
    description: "Leads you've reached out to — contacted, qualified, nurturing and converted. Mark one Lost and it goes back to Leads.",
    statuses: ["contacted", "qualified", "nurturing", "converted"],
    emptyTitle: "No good leads yet.",
    emptyDescription: "A lead lands here as soon as its status moves past New.",
    canCreate: false,
  },
};

// The page a lead with this status lives on — also where the lead page's
// "back" link goes.
export function leadListFor(status: LeadStatus): { title: string; href: string } {
  const scope = (Object.keys(SCOPES) as LeadListScope[]).find((key) => SCOPES[key].statuses.includes(status)) ?? "inbox";
  return { title: SCOPES[scope].title, href: SCOPES[scope].href };
}

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
// BUCKET_SORT_RANK in api/leads/work-queue.js exactly. A pill only shows
// when its bucket has leads in this page's scope, so "New" never appears
// on Good Leads and "Nurturing" never on the inbox.
const PRIORITY_PILLS: Array<{ label: string; value: WorkQueueBucket }> = [
  { label: "Overdue", value: "overdue" },
  { label: "Meeting Today", value: "meetingToday" },
  { label: "Today", value: "today" },
  { label: "New", value: "new" },
  { label: "Needs Requirements", value: "discoveryIncomplete" },
  { label: "Ready for Find Rooms", value: "readyForFindRooms" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Nurturing", value: "nurturing" },
  { label: "No Next Action", value: "noNextAction" },
];

function isWorkQueueBucket(value: string): value is WorkQueueBucket {
  return (WORK_QUEUE_BUCKETS as readonly string[]).includes(value);
}

// CRM Milestone 16 — lets the Dashboard deep-link into a pre-filtered list
// (e.g. `/dashboard/leads?bucket=new`, `?assignedTo=unassigned`) by reading
// these two params ONCE on mount.
function useInitialFilters(): { bucket: WorkQueueBucket | ""; assignedTo: string } {
  const searchParams = useSearchParams();
  const bucketParam = searchParams.get("bucket") || "";
  const assignedToParam = searchParams.get("assignedTo") || "";
  return {
    bucket: isWorkQueueBucket(bucketParam) ? bucketParam : "",
    assignedTo: assignedToParam,
  };
}

// The one work-queue query both the initial load and a manual reload send.
// `status` is this page's own status set, narrowed to one status when the
// status filter picks one of them.
function buildQuery(page: number, filters: LeadFilterValues, bucket: WorkQueueBucket | "", status: string) {
  return {
    page,
    limit: PAGE_SIZE,
    search: filters.search || undefined,
    status,
    source: filters.source || undefined,
    assignedTo: filters.assignedTo || undefined,
    bucket: bucket || undefined,
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

export function LeadListView({ scope }: { scope: LeadListScope }) {
  const config = SCOPES[scope];
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

  const statusParam =
    filters.status && (config.statuses as readonly string[]).includes(filters.status) ? filters.status : config.statuses.join(",");

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
    getWorkQueue(buildQuery(page, filters, bucket, statusParam))
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
        getWorkQueue(buildQuery(page, filters, bucket, statusParam))
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
  }, [page, filters, bucket, statusParam]);

  const hasActiveFilters = useMemo(
    () => Boolean(filters.search || filters.status || filters.source || filters.assignedTo || bucket),
    [filters, bucket]
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          config.canCreate ? (
            <>
              <Button variant="secondary" icon={RefreshCw} onClick={handleSync} disabled={isSyncing} iconClassName={isSyncing ? "animate-spin" : undefined}>
                {isSyncing ? "Syncing…" : "Refresh Leads"}
              </Button>
              <Button variant="primary" icon={Plus} onClick={() => setAddLeadOpen(true)}>
                Add Lead
              </Button>
            </>
          ) : undefined
        }
      />
      <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-faint">
        <span>{pagination ? `${pagination.total.toLocaleString()} total` : "Loading…"}</span>
        {config.canCreate && lastSyncedAt && (
          <>
            <span aria-hidden="true">·</span>
            <span>Last synced: {relativeTimeFromNow(lastSyncedAt)}</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRIORITY_PILLS.filter(({ value }) => bucket === value || (summary?.[value] ?? 0) > 0).map(({ label, value }) => (
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

      <LeadFilters
        values={filters}
        onChange={handleFiltersChange}
        sourceOptions={sourceOptions}
        staffOptions={staff}
        currentUserId={profile?.id ?? null}
        statusOptions={config.statuses}
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <LeadsTable
            leads={leads}
            isLoading={isLoading}
            hasActiveFilters={hasActiveFilters}
            staffById={staffById}
            belongs={(lead) => config.statuses.includes(lead.status)}
            onMoved={(lead) => {
              show(`Lead moved to ${leadListFor(lead.status).title}.`);
              reload();
            }}
            emptyTitle={config.emptyTitle}
            emptyDescription={config.emptyDescription}
          />

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
