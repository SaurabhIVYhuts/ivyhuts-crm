// Wraps GET/POST /api/leads/:id/presentations, GET
// /api/leads/:id/presentations/:presentationId and GET
// /api/leads/:id/presentations/:presentationId/download on the IVYHUTS
// backend (api/leads/[id]/presentations/index.js,
// .../[presentationId]/index.js, .../[presentationId]/download.js).
// Contract verified directly against that source (Milestone 23.8).
import { apiRequest, apiRequestBlob } from "./client";
import type { ApiCollectionResponse, ApiSuccessResponse } from "@/types/api";
import type { Presentation } from "@/types/presentation";

export function listPresentations(leadId: string) {
  return apiRequest<ApiCollectionResponse<Presentation>>(`/api/leads/${leadId}/presentations`, {
    method: "GET",
  });
}

export function getPresentation(leadId: string, presentationId: string) {
  return apiRequest<ApiSuccessResponse<Presentation>>(
    `/api/leads/${leadId}/presentations/${presentationId}`,
    { method: "GET" }
  );
}

// The only client input the backend accepts at all is an optional display
// title — the presentation's content is always loaded and derived
// server-side from the lead's already-saved AccommodationCuration, never
// sent from here. See that route's header comment. A 409 with error.code
// "NO_CURATION_SAVED" means nothing has been saved yet; PresentationsSection
// disables the button in that case, but the backend enforces it regardless.
export function generatePresentation(leadId: string, title?: string) {
  return apiRequest<ApiSuccessResponse<Presentation>>(`/api/leads/${leadId}/presentations`, {
    method: "POST",
    body: title ? { title } : {},
  });
}

// Fetches the .pptx as a Blob and triggers a browser download — the CRM
// never displays a raw backend URL as a plain link (credentials/CORS both
// go through the centralized client, same as every other request).
export async function downloadPresentation(
  leadId: string,
  presentationId: string,
  filename: string
): Promise<void> {
  const blob = await apiRequestBlob(`/api/leads/${leadId}/presentations/${presentationId}/download`, {
    method: "GET",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
