// Wraps POST /api/leads/:id/whatsapp/messages on the IVYHUTS backend
// (api/leads/[id]/whatsapp/messages.js). The CRM actually PERFORMING an
// external action (a real WhatsApp send) — distinct from
// src/lib/api/communications.ts's createCommunication, which only ever
// records that something happened elsewhere and still never sends anything.
import { apiRequest } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type { SendWhatsAppMessagePayload, SendWhatsAppMessageResult } from "@/types/whatsapp";

// `idempotencyKey` should be a fresh value per distinct "Send" click (e.g.
// crypto.randomUUID()), reused unchanged only when the CRM itself retries
// that exact same click after a network/provider failure — see the
// backend's duplicate-send protection (api/leads/[id]/whatsapp/messages.js).
export function sendWhatsAppMessage(leadId: string, payload: SendWhatsAppMessagePayload, idempotencyKey: string) {
  return apiRequest<ApiSuccessResponse<SendWhatsAppMessageResult>>(`/api/leads/${leadId}/whatsapp/messages`, {
    method: "POST",
    body: payload,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}
