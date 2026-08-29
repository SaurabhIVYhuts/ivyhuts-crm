"use client";

// Extracted from the pre-Milestone-16 dashboard's inline "Agent Workload"
// block — still one GET /api/leads/assignment-summary + one GET /api/staff
// (see the parent page). Manager/Admin-only. Redesigned as a real team
// performance table: only columns backed by AssignmentSummary's actual
// fields are shown (no per-agent "meetings"/"conversions" column — that
// data doesn't exist in this aggregate, and inventing it would violate the
// "never fabricate a metric" rule).
import { Users2 } from "lucide-react";
import type { AssignmentSummary } from "@/types/assignmentSummary";
import type { StaffUser } from "@/types/staff";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ErrorState } from "@/components/ui/ErrorState";
import type { ApiErrorState } from "@/lib/utils/errors";

interface Row {
  agentId: string;
  name: string;
  role: string | null;
  activeLeads: number;
  nurturingLeads: number;
  totalLeads: number;
  todayFollowUps: number;
  overdueFollowUps: number;
}

export function AgentWorkloadList({
  workloadSummary,
  staff,
  isLoading,
  error,
  onRetry,
  title = "Team Performance",
}: {
  workloadSummary: AssignmentSummary | null;
  staff: StaffUser[];
  isLoading: boolean;
  error: ApiErrorState | null;
  onRetry?: () => void;
  title?: string;
}) {
  const rows: Row[] = (workloadSummary?.agents ?? [])
    .map((row) => {
      const agent = staff.find((s) => s.id === row.agentId);
      return {
        agentId: row.agentId,
        name: agent?.name || `Agent #${row.agentId.slice(-6)}`,
        role: agent?.role ?? null,
        activeLeads: row.activeLeads,
        nurturingLeads: row.nurturingLeads,
        totalLeads: row.totalLeads,
        todayFollowUps: row.todayFollowUps,
        overdueFollowUps: row.overdueFollowUps,
      };
    })
    .sort((a, b) => b.activeLeads - a.activeLeads);

  const maxActive = Math.max(1, ...rows.map((r) => r.activeLeads));

  const columns: DataTableColumn<Row>[] = [
    {
      key: "agent",
      header: "Agent",
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.name} size="sm" />
          <div>
            <div className="font-medium text-ink">{row.name}</div>
            {row.role && <div className="text-xs text-faint">{row.role.replace(/_/g, " ")}</div>}
          </div>
        </div>
      ),
    },
    {
      key: "activeLeads",
      header: "Active Leads",
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full ${row.activeLeads / maxActive > 0.85 ? "bg-warning" : "bg-accent"}`}
              style={{ width: `${(row.activeLeads / maxActive) * 100}%` }}
            />
          </div>
          <span className="tabular-nums text-ink">{row.activeLeads}</span>
        </div>
      ),
    },
    { key: "totalLeads", header: "Total Leads", render: (row) => <span className="tabular-nums">{row.totalLeads}</span> },
    { key: "nurturingLeads", header: "Nurturing", render: (row) => <span className="tabular-nums">{row.nurturingLeads}</span> },
    {
      key: "followUps",
      header: "Follow-ups Due",
      render: (row) => (
        <span className="tabular-nums">
          {row.todayFollowUps}
          {row.overdueFollowUps > 0 && <span className="ml-1.5 text-danger">· {row.overdueFollowUps} overdue</span>}
        </span>
      ),
    },
  ];

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="p-4 pb-0">
        <CardHeader title={title} icon={Users2} />
      </div>
      {error ? (
        <div className="p-4 pt-0">
          <ErrorState error={error} onRetry={onRetry} />
        </div>
      ) : (
        <div className="px-4 pb-4">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.agentId}
            isLoading={isLoading}
            emptyIcon={Users2}
            emptyTitle="No assignment data available."
            skeletonRows={3}
          />
        </div>
      )}
    </Card>
  );
}
