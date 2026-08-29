// Wraps GET/PUT /api/leads/:id/accommodation-curation on the IVYHUTS
// backend (api/leads/[id]/accommodation-curation.js). Contract verified
// directly against that source, Milestone 23.6 — a real, working endpoint.
//
// `data` is null when nothing has been saved for this lead yet — that's a
// normal, expected response, not an error (same convention as
// src/lib/api/discovery.ts's getDiscovery).
import { apiRequest } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type { AccommodationCuration, AccommodationCurationInput } from "@/types/accommodationCuration";

export function getAccommodationCuration(leadId: string) {
  return apiRequest<ApiSuccessResponse<AccommodationCuration | null>>(`/api/leads/${leadId}/accommodation-curation`, {
    method: "GET",
  });
}

export function saveAccommodationCuration(leadId: string, payload: AccommodationCurationInput) {
  return apiRequest<ApiSuccessResponse<AccommodationCuration>>(`/api/leads/${leadId}/accommodation-curation`, {
    method: "PUT",
    body: payload,
  });
}
