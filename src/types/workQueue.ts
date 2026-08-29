// Mirrors GET /api/leads/work-queue on the ivyhuts-website backend
// (api/leads/work-queue.js, CRM Milestone 11). Field set verified directly
// against that handler's $project/response-building code — do not add
// fields here it doesn't actually return.
import type { LeadContact, LeadProperty, LeadStatus, LeadTemperature } from "./lead";
import type { FollowUpType, FollowUpPriority } from "./followUp";
import type { PaginationMeta } from "./api";

// Independent, possibly-overlapping categories (a nurturing lead with an
// upcoming follow-up is BOTH "nurturing" and would count toward "upcoming"
// — see the backend's own header comment on bucketMatchCondition). `bucket`
// on a WorkQueueLead below is the one mutually-exclusive pick among these,
// used for its row's badge/sort position — not what the summary counts or
// the `bucket` filter param mean.
//
// Milestone 23.12 — extended from the original 6 (overdue/today/new/
// upcoming/nurturing/noNextAction) with 4 real, backend-derived pipeline
// signals. Priority order (matches BUCKET_SORT_RANK in
// api/leads/work-queue.js exactly):
//   overdue > meetingToday > today > new > discoveryIncomplete >
//   readyForFindRooms > presentationNoFollowUp > upcoming > nurturing >
//   noNextAction
// discoveryIncomplete/readyForFindRooms/presentationNoFollowUp only ever
// apply to leads still being actively worked (status contacted/qualified)
// — never nurturing or converted/lost, so a parked or closed lead never
// wrongly resurfaces as "needs attention" (see that route's own comment).
export const WORK_QUEUE_BUCKETS = [
  "overdue",
  "meetingToday",
  "today",
  "new",
  "discoveryIncomplete",
  "readyForFindRooms",
  "presentationNoFollowUp",
  "upcoming",
  "nurturing",
  "noNextAction",
] as const;
export type WorkQueueBucket = (typeof WORK_QUEUE_BUCKETS)[number];

export interface WorkQueueSummary {
  overdue: number;
  meetingToday: number;
  today: number;
  new: number;
  discoveryIncomplete: number;
  readyForFindRooms: number;
  presentationNoFollowUp: number;
  upcoming: number;
  nurturing: number;
  noNextAction: number;
}

export interface WorkQueueNextFollowUp {
  id: string;
  type: FollowUpType;
  priority: FollowUpPriority;
  dueAt: string;
}

// Milestone 23.12 — the earliest still-SCHEDULED (never completed/
// cancelled) meeting, mirroring nextFollowUp's own shape/purpose.
export interface WorkQueueNextMeeting {
  id: string;
  scheduledAt: string;
}

// A purpose-built projection, NOT the full Lead — the backend's $project
// (api/leads/work-queue.js) omits userId/sourceDetails/convertedAt/lostAt/
// lostReason/archivedAt to keep the row payload small (Milestone 11 spec
// §22: "avoid downloading full documents unnecessarily"). Fetch
// GET /api/leads/:id (getLead) if a view needs those.
export interface WorkQueueLead {
  id: string;
  contact: LeadContact;
  status: LeadStatus;
  temperature: LeadTemperature;
  score: number;
  source: string | null;
  assignedTo: string | null;
  property: LeadProperty;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  firstContactAt: string | null;
  lastContactAt: string | null;
  // CRM Milestone 16 — added to the backend's $project (api/leads/work-queue.js)
  // so the Dashboard's "Customer Replied" signal doesn't need a second
  // request or a GET /api/leads/:id per row. Same field/meaning as
  // Lead.lastInboundCommunicationAt (see src/types/lead.ts): when equal to
  // `lastContactAt`, the most recent contact event was itself inbound — the
  // customer is still awaiting a response.
  lastInboundCommunicationAt: string | null;
  nextFollowUp: WorkQueueNextFollowUp | null;
  nextMeeting: WorkQueueNextMeeting | null;
  bucket: WorkQueueBucket;
}

export interface WorkQueueResponse {
  summary: WorkQueueSummary;
  leads: WorkQueueLead[];
  pagination: PaginationMeta;
}
