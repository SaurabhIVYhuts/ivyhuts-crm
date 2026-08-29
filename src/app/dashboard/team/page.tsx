"use client";

// Manager/Admin-only team view — same GET /api/leads/assignment-summary +
// GET /api/staff the Dashboard's own Team section already uses, just given
// its own dedicated page for a fuller view. No new backend endpoint.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAssignmentSummary } from "@/lib/api/leads";
import { listStaff } from "@/lib/api/staff";
import type { AssignmentSummary } from "@/types/assignmentSummary";
import type { StaffUser } from "@/types/staff";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { AgentWorkloadList } from "@/components/dashboard/AgentWorkloadList";
import { EmptyState } from "@/components/ui/EmptyState";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";
import { ShieldAlert } from "lucide-react";

export default function TeamPage() {
  const { profile, isLoading: isAuthLoading } = useAuth();
  const isManagerOrAdmin = profile?.role === "MARKETING_MANAGER" || profile?.role === "ADMIN";

  const [summary, setSummary] = useState<AssignmentSummary | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiErrorState | null>(null);

  const load = useCallback(async () => {
    if (!isManagerOrAdmin) return;
    try {
      const [summaryRes, staffRes] = await Promise.all([getAssignmentSummary(), listStaff()]);
      setSummary(summaryRes.data);
      setStaff(staffRes.data);
      setError(null);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [isManagerOrAdmin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const totalActive = summary?.agents.reduce((sum, a) => sum + a.activeLeads, 0) ?? null;
  const totalOverdue = summary?.agents.reduce((sum, a) => sum + a.overdueFollowUps, 0) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Team" description="Workload and follow-up load across your marketing/sales team." />

      {isAuthLoading ? null : !isManagerOrAdmin ? (
        <EmptyState icon={ShieldAlert} title="Manager/Admin access required." description="Team visibility is limited to MARKETING_MANAGER and ADMIN accounts." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Agents" value={summary?.agents.length ?? null} isLoading={isLoading} />
            <StatCard label="Active Leads" value={totalActive} isLoading={isLoading} />
            <StatCard label="Unassigned Leads" value={summary?.unassigned ?? null} isLoading={isLoading} href="/dashboard/leads?assignedTo=unassigned" tone="warning" />
            <StatCard label="Overdue Follow-ups" value={totalOverdue} isLoading={isLoading} tone="warning" />
          </div>

          <AgentWorkloadList workloadSummary={summary} staff={staff} isLoading={isLoading} error={error} onRetry={load} />
        </>
      )}
    </div>
  );
}
