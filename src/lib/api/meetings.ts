// Wraps GET/POST /api/leads/:id/meetings, GET/PATCH
// /api/leads/:id/meetings/:meetingId, and POST
// .../meetings/:meetingId/extract-requirements on the IVYHUTS backend
// (api/leads/[id]/meetings/index.js, .../[meetingId]/index.js,
// .../[meetingId]/extract-requirements.js). Contract verified directly
// against that source (Milestone 23.10, extended Milestone 23.14).
import { apiRequest } from "./client";
import type { ApiCollectionResponse, ApiSuccessResponse } from "@/types/api";
import type { Meeting, CreateMeetingInput, UpdateMeetingInput } from "@/types/meeting";

export function listMeetings(leadId: string) {
  return apiRequest<ApiCollectionResponse<Meeting>>(`/api/leads/${leadId}/meetings`, {
    method: "GET",
  });
}

export function createMeeting(leadId: string, payload: CreateMeetingInput) {
  return apiRequest<ApiSuccessResponse<Meeting>>(`/api/leads/${leadId}/meetings`, {
    method: "POST",
    body: payload,
  });
}

export function updateMeeting(leadId: string, meetingId: string, payload: UpdateMeetingInput) {
  return apiRequest<ApiSuccessResponse<Meeting>>(`/api/leads/${leadId}/meetings/${meetingId}`, {
    method: "PATCH",
    body: payload,
  });
}

// Explicit agent action only — never automatic. Runs AI-assisted extraction
// against this meeting's own transcriptText and stores the result as a
// suggestion on the meeting (never written to Discovery directly). 503 if
// transcript extraction isn't configured on this deployment; 400 if the
// meeting has no transcript text yet.
export function extractMeetingRequirements(leadId: string, meetingId: string) {
  return apiRequest<ApiSuccessResponse<Meeting>>(`/api/leads/${leadId}/meetings/${meetingId}/extract-requirements`, {
    method: "POST",
  });
}
