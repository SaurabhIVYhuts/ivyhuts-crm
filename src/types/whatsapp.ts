// Mirrors POST /api/leads/:id/whatsapp/messages on the ivyhuts-website
// backend (api/leads/[id]/whatsapp/messages.js, CRM Milestone 13). The CRM
// deliberately does not know anything about WhatsApp Graph API's own
// request/response shapes (message ids, media ids, webhook payloads) — the
// backend provider adapter (api/_lib/providers/whatsapp.js) owns all of
// that and only ever returns this small, safe result.

export interface SendWhatsAppMessagePayload {
  message: string;
  // Attaches a READY Presentation as a WhatsApp document instead of a plain
  // text message — omit for a text-only send.
  presentationId?: string;
}

export interface SendWhatsAppMessageResult {
  communicationId: string;
  providerMessageId: string;
  status: "sent";
}
