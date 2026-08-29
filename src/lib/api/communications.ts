// Wraps GET/POST /api/leads/:id/communications and GET/PATCH
// /api/leads/:id/communications/:communicationId on the IVYHUTS backend
// (api/leads/[id]/communications/index.js, .../[communicationId]/index.js
// — Milestone 23.11, a real backend contract for the first time). Records
// that a communication happened — never sends anything itself. A real send
// is NOT implemented anywhere in this codebase for any channel, including
// WhatsApp — src/lib/api/whatsapp.ts's endpoint always fails closed
// (503 "not_configured"); see WhatsAppSendForm.tsx.
import { apiRequest } from "./client";
import type { ApiCollectionResponse, ApiSuccessResponse } from "@/types/api";
import type { Communication, CommunicationInput, UpdateCommunicationInput } from "@/types/communication";

export function listCommunications(leadId: string) {
  return apiRequest<ApiCollectionResponse<Communication>>(`/api/leads/${leadId}/communications`, {
    method: "GET",
  });
}

export function createCommunication(leadId: string, payload: CommunicationInput) {
  return apiRequest<ApiSuccessResponse<Communication>>(`/api/leads/${leadId}/communications`, {
    method: "POST",
    body: payload,
  });
}

export function getCommunication(leadId: string, communicationId: string) {
  return apiRequest<ApiSuccessResponse<Communication>>(
    `/api/leads/${leadId}/communications/${communicationId}`,
    { method: "GET" }
  );
}

// Corrects a previously-logged communication (e.g. a typo in the notes) —
// never reassigns who it's attributed to; see that route's own comment.
export function updateCommunication(leadId: string, communicationId: string, payload: UpdateCommunicationInput) {
  return apiRequest<ApiSuccessResponse<Communication>>(
    `/api/leads/${leadId}/communications/${communicationId}`,
    { method: "PATCH", body: payload }
  );
}
