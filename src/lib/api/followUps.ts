// Wraps GET/POST /api/leads/:id/follow-ups and PATCH
// /api/leads/:id/follow-ups/:followUpId on the IVYHUTS backend
// (api/leads/[id]/follow-ups.js, .../follow-ups/[followUpId].js).
// Contract verified directly against that source.
import { apiRequest } from "./client";
import type { ApiCollectionResponse, ApiSuccessResponse } from "@/types/api";
import type { FollowUp, CreateFollowUpInput, UpdateFollowUpInput } from "@/types/followUp";

export function listFollowUps(leadId: string) {
  return apiRequest<ApiCollectionResponse<FollowUp>>(`/api/leads/${leadId}/follow-ups`, {
    method: "GET",
  });
}

export function createFollowUp(leadId: string, payload: CreateFollowUpInput) {
  return apiRequest<ApiSuccessResponse<FollowUp>>(`/api/leads/${leadId}/follow-ups`, {
    method: "POST",
    body: payload,
  });
}

export function getFollowUp(leadId: string, followUpId: string) {
  return apiRequest<ApiSuccessResponse<FollowUp>>(`/api/leads/${leadId}/follow-ups/${followUpId}`, {
    method: "GET",
  });
}

export function updateFollowUp(leadId: string, followUpId: string, payload: UpdateFollowUpInput) {
  return apiRequest<ApiSuccessResponse<FollowUp>>(`/api/leads/${leadId}/follow-ups/${followUpId}`, {
    method: "PATCH",
    body: payload,
  });
}
