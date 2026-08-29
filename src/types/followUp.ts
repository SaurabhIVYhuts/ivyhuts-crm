// Mirrors api/_lib/models/FollowUp.js and its toSafeFollowUp projection in
// the ivyhuts-website backend. Enum values verified against that model —
// do not add values here the backend doesn't support. As of Milestone
// 23.11, api/leads/[id]/follow-ups/index.js and .../[followUpId]/index.js
// are real, verified routes (not merely claimed by this file's comments,
// as a prior version of this file incorrectly did before that route
// existed).

export const FOLLOWUP_TYPES = ["call", "email", "whatsapp", "meeting", "other"] as const;
export type FollowUpType = (typeof FOLLOWUP_TYPES)[number];

export const FOLLOWUP_PRIORITIES = ["low", "medium", "high"] as const;
export type FollowUpPriority = (typeof FOLLOWUP_PRIORITIES)[number];

export const FOLLOWUP_STATUSES = ["pending", "completed", "cancelled"] as const;
export type FollowUpStatus = (typeof FOLLOWUP_STATUSES)[number];

export interface FollowUp {
  id: string;
  leadId: string;
  userId: string | null;
  assignedTo: string | null;
  type: FollowUpType;
  priority: FollowUpPriority;
  dueAt: string;
  status: FollowUpStatus;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Body for POST /api/leads/:id/follow-ups — assignedTo is never sent; the
// backend derives it from the Lead's own assignment.
export interface CreateFollowUpInput {
  type: FollowUpType;
  dueAt: string;
  priority?: FollowUpPriority;
  notes?: string | null;
}

// Body for PATCH /api/leads/:id/follow-ups/:followUpId — completedAt is
// never sent; the backend derives it when status becomes "completed".
export interface UpdateFollowUpInput {
  status?: FollowUpStatus;
  notes?: string | null;
}
