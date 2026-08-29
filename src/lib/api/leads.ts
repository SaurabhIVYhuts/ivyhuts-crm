// Wraps GET/POST /api/leads, GET/PATCH /api/leads/:id, PATCH
// /api/leads/:id/assignment, GET /api/leads/assignment-summary, and GET
// /api/leads/work-queue on the IVYHUTS backend (api/leads/index.js,
// api/leads/[id].js, api/leads/[id]/assignment.js,
// api/leads/assignment-summary.js, api/leads/work-queue.js). Contract
// verified directly against that source — see
// docs/marketing-data-architecture.md §12.3 for the summary. DELETE is not
// wrapped yet; add it here (not ad hoc in a component) once the CRM needs it.
import { apiRequest } from "./client";
import type { QueryValue } from "./client";
import type { ApiCollectionResponse, ApiSuccessResponse } from "@/types/api";
import type { Lead, LeadDetail, LeadStatus, LeadTemperature } from "@/types/lead";
import type { AssignmentSummary } from "@/types/assignmentSummary";
import type { WorkQueueResponse, WorkQueueBucket } from "@/types/workQueue";

export interface ListLeadsParams {
  [key: string]: QueryValue;
  page?: number;
  limit?: number;
  search?: string;
  status?: LeadStatus;
  source?: string;
  // A real Mongo user id filters to that agent's leads; the reserved
  // string "unassigned" filters to leads with no agent — see
  // api/leads/index.js's handleList.
  assignedTo?: string;
  userId?: string;
  city?: string;
  scoreMin?: number;
  scoreMax?: number;
  createdFrom?: string;
  createdTo?: string;
  includeArchived?: boolean;
}

export function listLeads(params: ListLeadsParams = {}) {
  return apiRequest<ApiCollectionResponse<Lead>>("/api/leads", { method: "GET", query: params });
}

export function getLead(id: string) {
  return apiRequest<ApiSuccessResponse<LeadDetail>>(`/api/leads/${id}`, { method: "GET" });
}

// Whitelisted business fields only, matching api/leads/[id].js's own
// PATCH whitelist — assignedTo/userId/createdAt/id are explicitly
// immutable there and are not exposed here either.
export interface UpdateLeadPayload {
  status?: LeadStatus;
  temperature?: LeadTemperature;
  notes?: string;
  lostReason?: string;
}

export function updateLead(id: string, payload: UpdateLeadPayload) {
  return apiRequest<ApiSuccessResponse<Lead>>(`/api/leads/${id}`, { method: "PATCH", body: payload });
}

// assignedTo is a real Mongo user id to assign, or null to unassign. The
// backend independently verifies the target exists and holds an internal
// role — this call cannot make an invalid assignment stick even if it tried.
export function assignLead(id: string, assignedTo: string | null) {
  return apiRequest<ApiSuccessResponse<Lead>>(`/api/leads/${id}/assignment`, {
    method: "PATCH",
    body: { assignedTo },
  });
}

export function getAssignmentSummary() {
  return apiRequest<ApiSuccessResponse<AssignmentSummary>>("/api/leads/assignment-summary", {
    method: "GET",
  });
}

export interface WorkQueueParams {
  [key: string]: QueryValue;
  page?: number;
  limit?: number;
  search?: string;
  status?: LeadStatus;
  source?: string;
  // Same convention as ListLeadsParams.assignedTo — a real Mongo user id,
  // or the reserved string "unassigned".
  assignedTo?: string;
  // Filters the returned `leads` page only — `summary` in the response
  // always reflects the full (unfiltered-by-bucket) scope, so a pill's
  // badge count and its filtered row count both come from one request.
  bucket?: WorkQueueBucket;
}

// One aggregate request drives both the Dashboard's "My Work" tiles
// (summary) and the Lead Inbox's prioritized table (leads) — see
// api/leads/work-queue.js's header comment for why this isn't just another
// GET /api/leads filter.
export function getWorkQueue(params: WorkQueueParams = {}) {
  return apiRequest<ApiSuccessResponse<WorkQueueResponse>>("/api/leads/work-queue", {
    method: "GET",
    query: params,
  });
}

export interface CreateLeadPayload {
  contact?: { name?: string; email?: string; phone?: string };
  source?: string;
  sourceDetails?: Record<string, unknown>;
  property?: { id?: string; name?: string; city?: string };
  notes?: string;
  status?: LeadStatus;
}

// Public endpoint on the backend (anonymous leads are valid business data)
// — but see api/leads/index.js: a client-supplied userId is only ever
// honored for an internal-role caller, and identity otherwise always comes
// from the session, never from this payload.
export function createLead(payload: CreateLeadPayload) {
  return apiRequest<ApiSuccessResponse<Lead>>("/api/leads", { method: "POST", body: payload });
}

export interface LeadSheetSyncSummary {
  totalRows: number;
  created: number;
  merged: number;
  unchanged: number;
  skipped: number;
}

export interface LeadSheetSyncResult {
  summary: LeadSheetSyncSummary;
  details: Array<{ externalLeadId: string; leadId: string; action: "created" | "merged" | "unchanged"; filledFields?: string[] }>;
  syncedAt: string;
}

// Manually triggers the same Google Sheet -> Lead sync the backend also
// runs on its own schedule (api/leads/import/sync-cron.js, every 15
// minutes — see that file and api/_lib/leadSheetSync.js on the backend).
// This is the CRM's "Refresh Leads" button: idempotent (safe to click
// repeatedly — dedupes on externalLeadId, never overwrites a field the
// CRM already has a value for), and fails with a real 503 (never a
// fabricated empty success) when Google Sheets isn't configured or is
// temporarily unreachable.
export function syncLeadsFromSheet() {
  return apiRequest<ApiSuccessResponse<LeadSheetSyncResult>>("/api/leads/import/google-sheet", { method: "POST" });
}
