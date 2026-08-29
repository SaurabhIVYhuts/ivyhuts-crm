// Mirrors GET /api/leads/assignment-summary's response in the
// ivyhuts-website backend (api/leads/assignment-summary.js). Aggregate
// counts only — never raw lead/contact data.

export interface AgentWorkload {
  agentId: string;
  activeLeads: number;
  nurturingLeads: number;
  totalLeads: number;
  todayFollowUps: number;
  overdueFollowUps: number;
}

export interface AssignmentSummary {
  agents: AgentWorkload[];
  unassigned: number;
}
