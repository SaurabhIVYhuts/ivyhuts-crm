// Wraps GET/PUT /api/leads/:id/discovery on the IVYHUTS backend
// (api/leads/[id]/discovery.js). Contract verified directly against that
// source. A single upsert (PUT) endpoint rather than separate
// create/update ones — the agent just keeps re-saving the same evolving
// record across calls; see that file's header comment for why.
import { apiRequest } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type { Discovery, DiscoveryInput } from "@/types/discovery";

// `data` is null when discovery hasn't been started for this lead yet —
// that's a normal, expected response, not an error.
export function getDiscovery(leadId: string) {
  return apiRequest<ApiSuccessResponse<Discovery | null>>(`/api/leads/${leadId}/discovery`, {
    method: "GET",
  });
}

export function saveDiscovery(leadId: string, payload: DiscoveryInput) {
  return apiRequest<ApiSuccessResponse<Discovery>>(`/api/leads/${leadId}/discovery`, {
    method: "PUT",
    body: payload,
  });
}
