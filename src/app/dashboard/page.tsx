"use client";

// CRM Milestone 16 — "Agent Command Center", redesigned for the visual
// overhaul: same data sources as before (GET /api/leads/work-queue for "My
// Work", GET /api/leads/assignment-summary + GET /api/staff for Manager/
// Admin team visibility — see AGENTS.md for why no new backend model/
// endpoint exists for any of this), presented as a real SaaS dashboard
// instead of a stack of oversized empty boxes.
import { useCallback, useEffect, useState } from "react";
import { Plus, CalendarClock, Video } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { getAssignmentSummary, getWorkQueue } from "@/lib/api/leads";
import { listStaff } from "@/lib/api/staff";
import { INTERNAL_ROLES } from "@/types/auth";
import type { AssignmentSummary } from "@/types/assignmentSummary";
import type { StaffUser } from "@/types/staff";
import type { WorkQueueLead, WorkQueueSummary } from "@/types/workQueue";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/dashboard/StatCard";
import { Pipeline } from "@/components/dashboard/Pipeline";
import { LeadAnalytics } from "@/components/dashboard/LeadAnalytics";
import { AgentWorkloadList } from "@/components/dashboard/AgentWorkloadList";
import { AddLeadModal } from "@/components/leads/AddLeadModal";
import {
  PriorityQueueSection,
  TodaysFollowUpsCard,
  MeetingTodayCard,
  OverdueCard,
  RecentRepliesCard,
} from "@/components/dashboard/WorkQueueSections";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";
import { useRouter } from "next/navigation";

// A bounded page of the agent's own prioritized leads (backend-sorted:
// overdue -> today -> new -> upcoming -> nurturing -> noNextAction) is
// enough to derive every section below client-side without a second
// request — same page-size convention the Lead Inbox already uses.
const MY_WORK_LIMIT = 25;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { show } = useToast();
  // CRM Milestone 18 — `isLoading` distinguishes "we don't know the role
  // yet" from "we checked, and it's genuinely not an internal role" so an
  // internal-role user never sees a flashed, factually wrong "no dashboard
  // data" message during the brief window before profile.role resolves.
  const { profile, isLoading: isAuthLoading } = useAuth();
  const role = profile?.role ?? null;
  const canSeeWorkQueue = role ? INTERNAL_ROLES.includes(role) : false;
  const isManagerOrAdmin = role === "MARKETING_MANAGER" || role === "ADMIN";
  const [addLeadOpen, setAddLeadOpen] = useState(false);

  // ── My Work: one request powers the KPI tiles, pipeline, priority queue,
  // today's follow-ups, overdue, and recent replies sections below. ──
  const [summary, setSummary] = useState<WorkQueueSummary | null>(null);
  const [myLeads, setMyLeads] = useState<WorkQueueLead[]>([]);
  const [isWorkQueueLoading, setIsWorkQueueLoading] = useState(true);
  const [workQueueError, setWorkQueueError] = useState<ApiErrorState | null>(null);

  const loadWorkQueue = useCallback(async () => {
    if (!profile?.id || !canSeeWorkQueue) return;
    try {
      const res = await getWorkQueue({ assignedTo: profile.id, limit: MY_WORK_LIMIT });
      setSummary(res.data.summary);
      setMyLeads(res.data.leads);
      setWorkQueueError(null);
    } catch (err) {
      setWorkQueueError(describeApiError(err));
    } finally {
      setIsWorkQueueLoading(false);
    }
  }, [profile, canSeeWorkQueue]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWorkQueue();
  }, [loadWorkQueue]);

  // ── Team: Manager/Admin only — unchanged data source, restyled presentation. ──
  const [workloadSummary, setWorkloadSummary] = useState<AssignmentSummary | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [isWorkloadLoading, setIsWorkloadLoading] = useState(true);
  const [workloadError, setWorkloadError] = useState<ApiErrorState | null>(null);

  const loadTeamData = useCallback(async () => {
    if (!isManagerOrAdmin) return;
    try {
      const [summaryRes, staffRes] = await Promise.all([getAssignmentSummary(), listStaff()]);
      setWorkloadSummary(summaryRes.data);
      setStaff(staffRes.data);
      setWorkloadError(null);
    } catch (err) {
      setWorkloadError(describeApiError(err));
    } finally {
      setIsWorkloadLoading(false);
    }
  }, [isManagerOrAdmin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTeamData();
  }, [loadTeamData]);

  const greetingName = profile?.name?.split(/\s+/)[0] || null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`${getGreeting()}${greetingName ? `, ${greetingName}` : ""}`}
        description="Here's what's happening with your sales pipeline today."
        actions={
          canSeeWorkQueue ? (
            <>
              <Button variant="primary" icon={Plus} onClick={() => setAddLeadOpen(true)}>
                Add Lead
              </Button>
              <Button variant="secondary" icon={CalendarClock} onClick={() => router.push("/dashboard/follow-ups")}>
                Schedule Follow-up
              </Button>
              <Button variant="secondary" icon={Video} onClick={() => router.push("/dashboard/meetings")}>
                Schedule Meeting
              </Button>
            </>
          ) : undefined
        }
      />

      {isAuthLoading ? null : !canSeeWorkQueue ? (
        <p className="text-sm text-subtle">No dashboard data is available for this account&apos;s role.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Overdue" value={summary?.overdue ?? null} isLoading={isWorkQueueLoading} href="/dashboard/leads?bucket=overdue" tone="warning" />
            <StatCard label="Meeting Today" value={summary?.meetingToday ?? null} isLoading={isWorkQueueLoading} href="/dashboard/leads?bucket=meetingToday" />
            <StatCard label="Follow-up Today" value={summary?.today ?? null} isLoading={isWorkQueueLoading} href="/dashboard/leads?bucket=today" />
            <StatCard label="New" value={summary?.new ?? null} isLoading={isWorkQueueLoading} href="/dashboard/leads?bucket=new" />
            <StatCard
              label="Needs Requirements"
              value={summary?.discoveryIncomplete ?? null}
              isLoading={isWorkQueueLoading}
              href="/dashboard/leads?bucket=discoveryIncomplete"
            />
            <StatCard
              label="Ready for Find Rooms"
              value={summary?.readyForFindRooms ?? null}
              isLoading={isWorkQueueLoading}
              href="/dashboard/leads?bucket=readyForFindRooms"
              tone="success"
            />
          </div>

          <Pipeline scopeUserId={profile?.id} />

          <LeadAnalytics scopeUserId={profile?.id} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PriorityQueueSection leads={myLeads} isLoading={isWorkQueueLoading} error={workQueueError} onRetry={loadWorkQueue} />
            <div className="flex flex-col gap-4">
              <MeetingTodayCard leads={myLeads} isLoading={isWorkQueueLoading} error={workQueueError} onRetry={loadWorkQueue} />
              <TodaysFollowUpsCard leads={myLeads} isLoading={isWorkQueueLoading} error={workQueueError} onRetry={loadWorkQueue} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OverdueCard leads={myLeads} isLoading={isWorkQueueLoading} error={workQueueError} onRetry={loadWorkQueue} />
            <RecentRepliesCard leads={myLeads} isLoading={isWorkQueueLoading} error={workQueueError} onRetry={loadWorkQueue} />
          </div>

          {isManagerOrAdmin && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Unassigned Leads" value={workloadSummary?.unassigned ?? null} isLoading={isWorkloadLoading} href="/dashboard/leads?assignedTo=unassigned" tone="warning" />
              </div>
              <AgentWorkloadList workloadSummary={workloadSummary} staff={staff} isLoading={isWorkloadLoading} error={workloadError} onRetry={loadTeamData} />
            </div>
          )}
        </>
      )}

      {addLeadOpen && (
        <AddLeadModal
          onClose={() => setAddLeadOpen(false)}
          onCreated={(lead) => {
            setAddLeadOpen(false);
            show("Lead created.");
            router.push(`/dashboard/leads/${lead.id}`);
          }}
        />
      )}
    </div>
  );
}
